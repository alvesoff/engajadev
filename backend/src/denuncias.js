/**
 * Denúncias: a comunidade avisa a moderação sobre posts com problema.
 * O post NÃO some sozinho depois de X denúncias: um grupo poderia derrubar o post de alguém.
 * Quem decide é uma pessoa da moderação (manter ou remover).
 */
import { erro } from './erros.js';
import { inicioDoDia } from './tempo.js';

export const MOTIVOS = {
  spam: 'Spam ou propaganda',
  fora_do_tema: 'Não é sobre tecnologia',
  link_quebrado: 'Link quebrado ou não abre',
  ofensivo: 'Conteúdo ofensivo',
  outro: 'Outro motivo',
};

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

/** Registra a denúncia de `usuario` contra `post` (já conferido: existe e não foi removido). */
export function denunciar(ctx, usuario, post, corpo) {
  if (post.usuario_id === usuario.id) throw erro(400, 'Você não pode denunciar o seu próprio post.');
  const motivo = corpo?.motivo;
  if (typeof motivo !== 'string' || !Object.hasOwn(MOTIVOS, motivo)) {
    throw erro(400, 'Escolha o motivo da denúncia.', { campo: 'motivo' });
  }
  const detalhe = texto(corpo?.detalhe);
  if (detalhe.length > 300) throw erro(400, 'O detalhe pode ter até 300 caracteres.', { campo: 'detalhe' });
  if (motivo === 'outro' && detalhe.length < 5) {
    throw erro(400, 'Conte em poucas palavras qual é o problema.', { campo: 'detalhe' });
  }

  if (ctx.db.prepare('SELECT 1 FROM denuncias WHERE post_id = ? AND usuario_id = ?').get(post.id, usuario.id)) {
    throw erro(409, 'Você já denunciou este post. A moderação vai analisar.');
  }
  const r = ctx.regras();
  const maximo = r.limites.denunciasPorDia;
  if (maximo > 0) {
    const hoje = inicioDoDia(ctx.agora(), r.periodo.fusoHorarioMinutos);
    const { n } = ctx.db
      .prepare('SELECT COUNT(*) AS n FROM denuncias WHERE usuario_id = ? AND criado_em >= ?')
      .get(usuario.id, hoje);
    if (n >= maximo) throw erro(429, `Você já fez ${maximo} denúncias hoje. Tente de novo amanhã.`);
  }
  ctx.db
    .prepare('INSERT INTO denuncias (post_id, usuario_id, motivo, detalhe, criado_em) VALUES (?, ?, ?, ?, ?)')
    .run(post.id, usuario.id, motivo, detalhe, ctx.agora());
}

/** Fecha as denúncias abertas de um post. Devolve quantas foram fechadas. */
export function resolverDenuncias(ctx, postId, { por, resultado }) {
  return Number(
    ctx.db
      .prepare(
        'UPDATE denuncias SET resolvida_em = ?, resolvida_por = ?, resultado = ? WHERE post_id = ? AND resolvida_em IS NULL',
      )
      .run(ctx.agora(), por, resultado, postId).changes,
  );
}

/** Fila da moderação: posts no ar com denúncias abertas, os mais denunciados primeiro. */
export function filaDeDenuncias(ctx) {
  const linhas = ctx.db
    .prepare(
      `SELECT d.*, u.nome AS quem_nome, u.usuario AS quem_usuario,
              p.titulo, p.url, p.rede, p.criado_em AS post_criado_em,
              a.id AS autor_id, a.nome AS autor_nome, a.usuario AS autor_usuario
       FROM denuncias d
       JOIN posts p ON p.id = d.post_id
       JOIN usuarios u ON u.id = d.usuario_id
       JOIN usuarios a ON a.id = p.usuario_id
       WHERE d.resolvida_em IS NULL AND p.removido_em IS NULL
       ORDER BY d.id`,
    )
    .all();
  const porPost = new Map();
  for (const l of linhas) {
    if (!porPost.has(l.post_id)) {
      porPost.set(l.post_id, {
        post: {
          id: l.post_id,
          titulo: l.titulo,
          url: l.url,
          rede: l.rede,
          criadoEm: l.post_criado_em,
          autor: { id: l.autor_id, nome: l.autor_nome, usuario: l.autor_usuario },
        },
        total: 0,
        motivos: {},
        ultima: 0,
        denuncias: [],
      });
    }
    const g = porPost.get(l.post_id);
    g.total += 1;
    g.motivos[l.motivo] = (g.motivos[l.motivo] ?? 0) + 1;
    g.ultima = Math.max(g.ultima, l.criado_em);
    g.denuncias.push({
      id: l.id,
      motivo: l.motivo,
      detalhe: l.detalhe,
      criadoEm: l.criado_em,
      quem: { nome: l.quem_nome, usuario: l.quem_usuario },
    });
  }
  return [...porPost.values()].sort((a, b) => b.total - a.total || b.ultima - a.ultima);
}
