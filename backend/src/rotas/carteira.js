import { Router } from 'express';
import { exigirLogin } from './auth.js';
import { resumoCarteira, extrato } from '../carteira.js';
import { resgatesDe } from '../premios.js';

export function rotasCarteira(ctx) {
  const r = Router();
  r.get('/', exigirLogin, (req, res) => {
    const itens = extrato(ctx, req.usuario.id, { antes: req.query.antes, limite: req.query.limite });
    res.json({
      ...resumoCarteira(ctx, req.usuario.id),
      extrato: itens,
      proximo: itens.length ? itens.at(-1).id : null,
      resgates: resgatesDe(ctx, req.usuario.id),
    });
  });
  return r;
}
