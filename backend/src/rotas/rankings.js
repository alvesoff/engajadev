import { Router } from 'express';
import { erro } from '../erros.js';
import { calcularRanking, PERIODOS, TIPOS } from '../rankings.js';

export function rotasRankings(ctx) {
  const r = Router();
  r.get('/', (req, res) => {
    const periodo = req.query.periodo ?? 'semana';
    const tipo = req.query.tipo ?? 'engajador';
    if (!PERIODOS.includes(periodo)) throw erro(400, 'Período inválido. Use "semana" ou "geral".');
    if (!TIPOS.includes(tipo)) throw erro(400, 'Tipo inválido. Use "engajador" ou "criador".');
    res.json(calcularRanking(ctx, { periodo, tipo }));
  });
  return r;
}
