import { Router } from 'express';
import { erro } from '../erros.js';
import { transacao } from '../db.js';
import { analisarLink, NOMES_REDES } from '../redes.js';
import { exigirLogin } from './auth.js';
import { pontuarCurtida, pontuarComentario, pontuarPublicacao, estornar } from '../pontos.js';
import { idsEmDestaque } from '../premios.js';

const texto = (v) => (typeof v === 'string' ? v.trim() : '');

const SELECT_POST = `
  SELECT p.*, u.nome AS autor_nome, u.usuario AS autor_usuario,
    (SELECT COUNT(*) FROM curtidas c WHERE c.post_id = p.id AND c.ativa = 1) AS n_curtidas,
    (SELECT COUNT(*) FROM comentarios c WHERE c.post_id = p.id) AS n_comentarios,
    EXISTS (SELECT 1 FROM curtidas c WHERE c.post_id = p.id AND c.usuario_id = @eu AND c.ativa = 1) AS curtiu
  FROM posts p JOIN usuarios u ON u.id = p.usuario_id`;

export function postPublico(p) {
  return {
    id: p.id,
    url: p.url,
    titulo: p.titulo,
    descricao: p.descricao,
    rede: p.rede,
    criadoEm: p.criado_em,
    autor: { id: p.usuario_id, nome: p.autor_nome, usuario: p.autor_usuario },
    curtidas: p.n_curtidas,
    comentarios: p.n_comentarios,
    curtiu: Boolean(p.curtiu),
  };
}

/** Feed: do mais novo para o mais antigo, paginado pelo id ("antes"). */
export function listarPosts(ctx, { eu = 0, rede, autorId, antes, limite = 20 }) {
  const where = ['p.removido_em IS NULL'];
  const params = { eu, limite: Math.min(Math.max(Number(limite) || 20, 1), 50) };
  if (rede) {
    where.push('p.rede = @rede');
    params.rede = rede;
  }
  if (autorId) {
    where.push('p.usuario_id = @autor');
    params.autor = autorId;
  }
  if (antes) {
    where.push('p.id < @antes');
    params.antes = Number(antes) || 0;
  }
  const sql = `${SELECT_POST} WHERE ${where.join(' AND ')} ORDER BY p.id DESC LIMIT @limite`;
  return ctx.db.prepare(sql).all(params).map(postPublico);
}

function buscarPost(ctx, id, eu = 0) {
  const p = ctx.db.prepare(`${SELECT_POST} WHERE p.id = @id`).get({ id: Number(id) || 0, eu });
  if (!p) throw erro(404, 'Post não encontrado.');
  if (p.removido_em) throw erro(404, 'Este post foi removido.');
  return p;
}

const comentarioPublico = (c) => ({
  id: c.id,
  texto: c.texto,
  criadoEm: c.criado_em,
  autor: { id: c.usuario_id, nome: c.nome, usuario: c.usuario },
});

export function rotasPosts(ctx) {
  const r = Router();

  r.get('/', (req, res) => {
    const rede = NOMES_REDES.includes(req.query.rede) ? req.query.rede : undefined;
    const eu = req.usuario?.id ?? 0;
    const posts = listarPosts(ctx, { eu, rede, antes: req.query.antes, limite: req.query.limite });
    // Posts em destaque (prêmio da 2ª fase) vêm à parte, só na primeira página, sem mexer na paginação.
    const destaques = req.query.antes
      ? []
      : idsEmDestaque(ctx)
          .map(({ post_id: id, ate }) => {
            const p = ctx.db.prepare(`${SELECT_POST} WHERE p.id = @id AND p.removido_em IS NULL`).get({ id, eu });
            return p && (!rede || p.rede === rede) ? { ...postPublico(p), destaqueAte: ate } : null;
          })
          .filter(Boolean);
    res.json({ posts, proximo: posts.length ? posts.at(-1).id : null, destaques });
  });

  r.post('/', exigirLogin, (req, res) => {
    const regras = ctx.regras();
    const link = analisarLink(req.body?.url);
    const titulo = texto(req.body?.titulo);
    const descricao = texto(req.body?.descricao);
    if (!texto(req.body?.url)) throw erro(400, 'Cole o link do seu post.', { campo: 'url' });
    if (!link) throw erro(400, 'Este link não parece válido. Ele precisa começar com http:// ou https://.', { campo: 'url' });
    if (titulo.length < 3 || titulo.length > regras.texto.tituloMax) {
      throw erro(400, `O título deve ter de 3 a ${regras.texto.tituloMax} caracteres.`, { campo: 'titulo' });
    }
    if (descricao.length > regras.texto.descricaoMax) {
      throw erro(400, `A descrição pode ter até ${regras.texto.descricaoMax} caracteres.`, { campo: 'descricao' });
    }
    if (ctx.db.prepare('SELECT 1 FROM posts WHERE url = ?').get(link.url)) {
      throw erro(409, 'Este link já foi divulgado no EngajaDev.', { campo: 'url' });
    }
    const resultado = transacao(ctx.db, () => {
      ctx.antesDePostar?.(req.usuario);
      const { lastInsertRowid } = ctx.db
        .prepare('INSERT INTO posts (usuario_id, url, titulo, descricao, rede, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
        .run(req.usuario.id, link.url, titulo, descricao, link.rede, ctx.agora());
      const post = ctx.db.prepare('SELECT * FROM posts WHERE id = ?').get(lastInsertRowid);
      return { id: post.id, pontos: pontuarPublicacao(ctx, { post }) };
    });
    res.status(201).json({ post: postPublico(buscarPost(ctx, resultado.id, req.usuario.id)), pontos: resultado.pontos });
  });

  r.get('/:id', (req, res) => {
    const p = buscarPost(ctx, req.params.id, req.usuario?.id ?? 0);
    const comentarios = ctx.db
      .prepare(
        `SELECT c.*, u.nome, u.usuario FROM comentarios c JOIN usuarios u ON u.id = c.usuario_id
         WHERE c.post_id = ? ORDER BY c.id`,
      )
      .all(p.id)
      .map(comentarioPublico);
    res.json({ post: postPublico(p), comentarios });
  });

  r.post('/:id/curtida', exigirLogin, (req, res) => {
    const post = buscarPost(ctx, req.params.id, req.usuario.id);
    const pontos = transacao(ctx.db, () => {
      const existente = ctx.db.prepare('SELECT * FROM curtidas WHERE post_id = ? AND usuario_id = ?').get(post.id, req.usuario.id);
      if (existente?.ativa) return { engajador: 0, criador: 0, motivo: 'ja_curtiu' };
      if (existente) {
        // Curtir de novo depois de descurtir volta a curtida, mas não pontua de novo.
        ctx.db.prepare('UPDATE curtidas SET ativa = 1 WHERE id = ?').run(existente.id);
        return { engajador: 0, criador: 0, motivo: 'ja_pontuou' };
      }
      ctx.antesDeEngajar?.(req.usuario);
      const { lastInsertRowid } = ctx.db
        .prepare('INSERT INTO curtidas (post_id, usuario_id, ativa, criado_em) VALUES (?, ?, 1, ?)')
        .run(post.id, req.usuario.id, ctx.agora());
      const curtida = ctx.db.prepare('SELECT * FROM curtidas WHERE id = ?').get(lastInsertRowid);
      return pontuarCurtida(ctx, { curtida, post });
    });
    res.json({ post: postPublico(buscarPost(ctx, post.id, req.usuario.id)), pontos });
  });

  r.delete('/:id/curtida', exigirLogin, (req, res) => {
    const post = buscarPost(ctx, req.params.id, req.usuario.id);
    transacao(ctx.db, () => {
      const curtida = ctx.db
        .prepare('SELECT * FROM curtidas WHERE post_id = ? AND usuario_id = ? AND ativa = 1')
        .get(post.id, req.usuario.id);
      if (!curtida) return;
      ctx.db.prepare('UPDATE curtidas SET ativa = 0 WHERE id = ?').run(curtida.id);
      // Descurtir devolve os pontos de quem curtiu e do autor.
      estornar(ctx, 'curtida', curtida.id);
    });
    res.json({ post: postPublico(buscarPost(ctx, post.id, req.usuario.id)) });
  });

  r.post('/:id/comentarios', exigirLogin, (req, res) => {
    const regras = ctx.regras();
    const post = buscarPost(ctx, req.params.id, req.usuario.id);
    const conteudo = texto(req.body?.texto);
    if (!conteudo) throw erro(400, 'Escreva um comentário.', { campo: 'texto' });
    if (conteudo.length > regras.texto.comentarioMax) {
      throw erro(400, `O comentário pode ter até ${regras.texto.comentarioMax} caracteres.`, { campo: 'texto' });
    }
    const resultado = transacao(ctx.db, () => {
      ctx.antesDeEngajar?.(req.usuario);
      const { lastInsertRowid } = ctx.db
        .prepare('INSERT INTO comentarios (post_id, usuario_id, texto, criado_em) VALUES (?, ?, ?, ?)')
        .run(post.id, req.usuario.id, conteudo, ctx.agora());
      const comentario = ctx.db.prepare('SELECT * FROM comentarios WHERE id = ?').get(lastInsertRowid);
      return { comentario, pontos: pontuarComentario(ctx, { comentario, post }) };
    });
    const c = resultado.comentario;
    res.status(201).json({
      comentario: comentarioPublico({ ...c, nome: req.usuario.nome, usuario: req.usuario.usuario }),
      pontos: resultado.pontos,
    });
  });

  /**
   * Remover um post. Ele some do feed, do perfil e dos destaques, mas a linha fica no banco.
   * - O autor apaga o próprio post: os pontos de todos ficam (foram ganhos de verdade).
   * - O admin remove (spam, link quebrado, fora do tema): os pontos que o AUTOR ganhou com o post
   *   saem do livro-razão e o link continua bloqueado. Quem curtiu ou comentou agiu de boa-fé e
   *   mantém os pontos (e o saldo de ninguém fica negativo por culpa de outra pessoa).
   * Nos dois casos o link continua bloqueado: apagar e divulgar de novo faria todos pontuarem
   * outra vez pelo mesmo post.
   */
  r.delete('/:id', exigirLogin, (req, res) => {
    const post = buscarPost(ctx, req.params.id, req.usuario.id);
    const autor = post.usuario_id === req.usuario.id;
    if (!autor && !ctx.ehAdmin(req.usuario)) throw erro(403, 'Só quem publicou ou quem administra pode remover este post.');
    const motivo = autor ? 'autor' : 'moderacao';
    const estornados = transacao(ctx.db, () => {
      ctx.db
        .prepare(
          'UPDATE posts SET removido_em = ?, removido_por = ?, removido_motivo = ? WHERE id = ?',
        )
        .run(ctx.agora(), req.usuario.id, motivo, post.id);
      if (motivo === 'autor') return 0;
      return Number(ctx.db.prepare('DELETE FROM lancamentos WHERE post_id = ? AND usuario_id = ?').run(post.id, post.usuario_id).changes);
    });
    res.json({ removido: true, motivo, lancamentosEstornados: estornados });
  });

  return r;
}
