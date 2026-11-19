/**
 * Prêmios (2ª fase): catálogo e resgate.
 * O saldo da carteira = tudo o que a pessoa ganhou − resgates não cancelados.
 * Resgatar não mexe no livro-razão de pontos, então rankings e limites diários não mudam.
 */
import { erro } from './erros.js';
import { transacao } from './db.js';

const DIA = 86_400_000;
export const TIPOS_PREMIO = ['brinde', 'destaque'];
export const STATUS = ['pendente', 'entregue', 'cancelado'];

export const premioPublico = (p) => ({
  id: p.id,
  nome: p.nome,
  descricao: p.descricao,
  custo: p.custo,
  estoque: p.estoque, // null = sem limite
  tipo: p.tipo,
  diasDestaque: p.dias_destaque,
  ativo: Boolean(p.ativo),
});

/** Total já gasto em resgates (pendentes e entregues; cancelados voltam para o saldo). */
export function totalResgatado(ctx, usuarioId) {
  return ctx.db
    .prepare(`SELECT COALESCE(SUM(custo), 0) AS s FROM resgates WHERE usuario_id = ? AND status <> 'cancelado'`)
    .get(usuarioId).s;
}

function saldoAtual(ctx, usuarioId) {
  const { ganho } = ctx.db.prepare('SELECT COALESCE(SUM(pontos), 0) AS ganho FROM lancamentos WHERE usuario_id = ?').get(usuarioId);
  return ganho - totalResgatado(ctx, usuarioId);
}

/**
 * Troca pontos por um prêmio. Tudo numa transação só (sem await no meio):
 * confere o saldo, baixa o estoque e grava o resgate. Assim os mesmos pontos não são gastos duas vezes.
 */
export function resgatar(ctx, usuario, premioId, { postId } = {}) {
  return transacao(ctx.db, () => {
    const premio = ctx.db.prepare('SELECT * FROM premios WHERE id = ?').get(Number(premioId) || 0);
    if (!premio || !premio.ativo) throw erro(404, 'Prêmio não encontrado.');

    let post = null;
    if (premio.tipo === 'destaque') {
      if (!postId) throw erro(400, 'Escolha qual dos seus posts vai ficar em destaque.', { campo: 'postId' });
      post = ctx.db.prepare('SELECT * FROM posts WHERE id = ?').get(Number(postId) || 0);
      if (!post || post.usuario_id !== usuario.id) {
        throw erro(400, 'Você só pode destacar um post seu.', { campo: 'postId' });
      }
      const ativo = ctx.db
        .prepare(`SELECT destaque_ate FROM resgates WHERE post_id = ? AND status <> 'cancelado' AND destaque_ate > ?`)
        .get(post.id, ctx.agora());
      if (ativo) throw erro(409, 'Este post já está em destaque.', { campo: 'postId' });
    }

    const saldo = saldoAtual(ctx, usuario.id);
    if (saldo < premio.custo) {
      const faltam = premio.custo - saldo;
      throw erro(400, `Faltam ${faltam} ${faltam === 1 ? 'ponto' : 'pontos'} para este prêmio.`, { faltam });
    }

    const { changes } = ctx.db
      .prepare('UPDATE premios SET estoque = estoque - 1 WHERE id = ? AND estoque IS NOT NULL AND estoque > 0')
      .run(premio.id);
    if (premio.estoque !== null && changes === 0) throw erro(409, 'Este prêmio acabou. Escolha outro.');

    const agora = ctx.agora();
    // O destaque é entregue na hora; o brinde fica pendente até a organização entregar.
    const status = premio.tipo === 'destaque' ? 'entregue' : 'pendente';
    const destaqueAte = premio.tipo === 'destaque' ? agora + premio.dias_destaque * DIA : null;
    const { lastInsertRowid } = ctx.db
      .prepare(
        `INSERT INTO resgates (usuario_id, premio_id, custo, status, post_id, destaque_ate, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(usuario.id, premio.id, premio.custo, status, post?.id ?? null, destaqueAte, agora, agora);
    return { resgate: buscarResgate(ctx, Number(lastInsertRowid)), saldo: saldo - premio.custo };
  });
}

const SELECT_RESGATE = `
  SELECT r.*, p.nome AS premio_nome, p.tipo AS premio_tipo, u.nome AS usuario_nome, u.usuario AS usuario_usuario,
         u.email AS usuario_email, po.titulo AS post_titulo
  FROM resgates r
  JOIN premios p ON p.id = r.premio_id
  JOIN usuarios u ON u.id = r.usuario_id
  LEFT JOIN posts po ON po.id = r.post_id`;

function resgatePublico(r, { comEmail = false } = {}) {
  return {
    id: r.id,
    premio: { id: r.premio_id, nome: r.premio_nome, tipo: r.premio_tipo },
    custo: r.custo,
    status: r.status,
    post: r.post_id ? { id: r.post_id, titulo: r.post_titulo } : null,
    destaqueAte: r.destaque_ate,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em,
    usuario: {
      id: r.usuario_id,
      nome: r.usuario_nome,
      usuario: r.usuario_usuario,
      ...(comEmail ? { email: r.usuario_email } : {}),
    },
  };
}

function buscarResgate(ctx, id, opcoes) {
  const r = ctx.db.prepare(`${SELECT_RESGATE} WHERE r.id = ?`).get(id);
  return r ? resgatePublico(r, opcoes) : null;
}

export function resgatesDe(ctx, usuarioId) {
  return ctx.db
    .prepare(`${SELECT_RESGATE} WHERE r.usuario_id = ? ORDER BY r.id DESC LIMIT 50`)
    .all(usuarioId)
    .map((r) => resgatePublico(r));
}

/** Lista para o admin (com e-mail, para combinar a entrega). */
export function listarResgates(ctx, { status } = {}) {
  const where = status ? 'WHERE r.status = @status' : '';
  return ctx.db
    .prepare(`${SELECT_RESGATE} ${where} ORDER BY r.status = 'pendente' DESC, r.id DESC LIMIT 200`)
    .all(status ? { status } : {})
    .map((r) => resgatePublico(r, { comEmail: true }));
}

/** Admin marca como entregue ou cancela. Só sai de "pendente"; cancelar devolve os pontos e o estoque uma vez só. */
export function mudarStatus(ctx, id, novo) {
  if (!['entregue', 'cancelado'].includes(novo)) throw erro(400, 'Status inválido. Use "entregue" ou "cancelado".');
  return transacao(ctx.db, () => {
    const r = ctx.db.prepare('SELECT * FROM resgates WHERE id = ?').get(Number(id) || 0);
    if (!r) throw erro(404, 'Resgate não encontrado.');
    if (r.status !== 'pendente') throw erro(409, `Este resgate já está ${r.status === 'entregue' ? 'entregue' : 'cancelado'}.`);
    ctx.db.prepare('UPDATE resgates SET status = ?, atualizado_em = ? WHERE id = ?').run(novo, ctx.agora(), r.id);
    if (novo === 'cancelado') {
      ctx.db.prepare('UPDATE premios SET estoque = estoque + 1 WHERE id = ? AND estoque IS NOT NULL').run(r.premio_id);
    }
    return buscarResgate(ctx, r.id, { comEmail: true });
  });
}

/** Confere os campos de um prêmio criado ou editado pelo admin. */
export function validarPremio(corpo, atual) {
  const v = { ...atual, ...corpo };
  const nome = typeof v.nome === 'string' ? v.nome.trim() : '';
  const descricao = typeof v.descricao === 'string' ? v.descricao.trim() : '';
  const inteiro = (x) => (typeof x === 'string' && x.trim() !== '' ? Number(x) : x);
  const custo = inteiro(v.custo);
  const estoque = v.estoque === null || v.estoque === '' || v.estoque === undefined ? null : inteiro(v.estoque);
  const tipo = v.tipo ?? 'brinde';
  const dias = v.diasDestaque === null || v.diasDestaque === '' || v.diasDestaque === undefined ? null : inteiro(v.diasDestaque);

  if (nome.length < 3 || nome.length > 80) throw erro(400, 'O nome do prêmio deve ter de 3 a 80 caracteres.', { campo: 'nome' });
  if (descricao.length > 300) throw erro(400, 'A descrição pode ter até 300 caracteres.', { campo: 'descricao' });
  if (!Number.isInteger(custo) || custo < 1 || custo > 1_000_000) {
    throw erro(400, 'O custo deve ser um número inteiro de 1 a 1000000 pontos.', { campo: 'custo' });
  }
  if (estoque !== null && (!Number.isInteger(estoque) || estoque < 0 || estoque > 1_000_000)) {
    throw erro(400, 'O estoque deve ser um número inteiro de 0 a 1000000, ou vazio para sem limite.', { campo: 'estoque' });
  }
  if (!TIPOS_PREMIO.includes(tipo)) throw erro(400, 'Tipo inválido. Use "brinde" ou "destaque".', { campo: 'tipo' });
  if (tipo === 'destaque' && (!Number.isInteger(dias) || dias < 1 || dias > 30)) {
    throw erro(400, 'Diga por quantos dias o post fica em destaque (de 1 a 30).', { campo: 'diasDestaque' });
  }
  return {
    nome,
    descricao,
    custo,
    estoque,
    tipo,
    diasDestaque: tipo === 'destaque' ? dias : null,
    ativo: v.ativo === undefined ? true : Boolean(v.ativo),
  };
}

/** Posts em destaque agora (resgate de destaque que ainda não venceu). */
export function idsEmDestaque(ctx) {
  return ctx.db
    .prepare(
      `SELECT post_id, MAX(destaque_ate) AS ate FROM resgates
       WHERE post_id IS NOT NULL AND status <> 'cancelado' AND destaque_ate > ?
       GROUP BY post_id ORDER BY ate DESC LIMIT 5`,
    )
    .all(ctx.agora());
}
