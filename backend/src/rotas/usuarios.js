import { Router } from 'express';
import { erro } from '../erros.js';
import { listarPosts } from './posts.js';
import { resumoCarteira } from '../carteira.js';
import { posicaoNoRanking, PERIODOS, TIPOS } from '../rankings.js';

/** Perfil público: um mini-portfólio com posts, pontos e posição nos rankings. Nunca mostra o e-mail. */
export function perfilPublico(ctx, u, eu = 0) {
  const carteira = resumoCarteira(ctx, u.id);
  const posicoes = {};
  for (const periodo of PERIODOS) {
    posicoes[periodo] = {};
    for (const tipo of TIPOS) posicoes[periodo][tipo] = posicaoNoRanking(ctx, u.id, { periodo, tipo });
  }
  const n = ctx.db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM posts WHERE usuario_id = @id AND removido_em IS NULL) AS posts,
         (SELECT COUNT(*) FROM curtidas c JOIN posts p ON p.id = c.post_id
           WHERE p.usuario_id = @id AND p.removido_em IS NULL AND c.ativa = 1) AS curtidas_recebidas,
         (SELECT COUNT(*) FROM comentarios c JOIN posts p ON p.id = c.post_id
           WHERE p.usuario_id = @id AND p.removido_em IS NULL) AS comentarios_recebidos,
         (SELECT COUNT(*) FROM curtidas WHERE usuario_id = @id AND ativa = 1) AS curtidas_feitas,
         (SELECT COUNT(*) FROM comentarios WHERE usuario_id = @id) AS comentarios_feitos`,
    )
    .get({ id: u.id });
  return {
    usuario: { id: u.id, nome: u.nome, usuario: u.usuario, criadoEm: u.criado_em },
    // total = tudo o que a pessoa já ganhou (resgatar prêmios não diminui o que aparece no perfil)
    pontos: { total: carteira.totalGanho, semana: carteira.semana, porPapel: carteira.porPapel },
    posicoes,
    numeros: {
      posts: n.posts,
      curtidasRecebidas: n.curtidas_recebidas,
      comentariosRecebidos: n.comentarios_recebidos,
      curtidasFeitas: n.curtidas_feitas,
      comentariosFeitos: n.comentarios_feitos,
    },
    posts: listarPosts(ctx, { eu, autorId: u.id, limite: 50 }),
  };
}

export function rotasUsuarios(ctx) {
  const r = Router();
  r.get('/:usuario', (req, res) => {
    const u = ctx.db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(String(req.params.usuario).replace(/^@/, ''));
    if (!u) throw erro(404, 'Pessoa não encontrada.');
    res.json(perfilPublico(ctx, u, req.usuario?.id ?? 0));
  });
  return r;
}
