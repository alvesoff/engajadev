import { Router } from 'express';
import { erro } from '../erros.js';
import { exigirLogin } from './auth.js';
import { denunciar, filaDeDenuncias, resolverDenuncias, MOTIVOS } from '../denuncias.js';

export function rotasDenuncias(ctx) {
  const r = Router();
  const admin = (req, _res, next) => {
    if (!ctx.ehAdmin(req.usuario)) return next(erro(403, 'Só quem administra vê as denúncias.'));
    next();
  };
  const postNoAr = (id) => {
    const post = ctx.db.prepare('SELECT * FROM posts WHERE id = ?').get(Number(id) || 0);
    if (!post) throw erro(404, 'Post não encontrado.');
    if (post.removido_em) throw erro(404, 'Este post foi removido.');
    return post;
  };

  r.get('/denuncias/motivos', (_req, res) => res.json({ motivos: MOTIVOS }));

  r.post('/posts/:id/denuncias', exigirLogin, (req, res) => {
    denunciar(ctx, req.usuario, postNoAr(req.params.id), req.body);
    res.status(201).json({ ok: true });
  });

  r.get('/admin/denuncias', exigirLogin, admin, (_req, res) => {
    res.json({ fila: filaDeDenuncias(ctx), motivos: MOTIVOS });
  });

  // "Manter": a moderação olhou e o post fica. Para remover, use DELETE /api/posts/:id
  // (as denúncias abertas do post são fechadas como "removido").
  r.post('/admin/denuncias/:postId/manter', exigirLogin, admin, (req, res) => {
    const post = postNoAr(req.params.postId);
    const fechadas = resolverDenuncias(ctx, post.id, { por: req.usuario.id, resultado: 'mantido' });
    if (!fechadas) throw erro(404, 'Este post não tem denúncias abertas.');
    res.json({ fechadas });
  });

  return r;
}
