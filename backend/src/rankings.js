import { janela } from './tempo.js';

export const PERIODOS = ['semana', 'geral'];
export const TIPOS = ['engajador', 'criador'];

/**
 * Ranking de um tipo (engajador ou criador) num período (semana ou geral).
 * "Zerar a semana" é só a janela de tempo andar: nenhum ponto é apagado.
 * O Top Geral só lista quem tem pelo menos o limiar de pontos (10 por padrão).
 */
export function calcularRanking(ctx, { periodo, tipo, limite }) {
  const r = ctx.regras();
  const { inicio, fim } = janela(periodo, ctx.agora(), r.periodo);
  const minimo = periodo === 'geral' ? Math.max(1, r.ranking.limiarTopGeral) : 1;
  const linhas = ctx.db
    .prepare(
      `SELECT u.id, u.nome, u.usuario, SUM(l.pontos) AS total, MAX(l.criado_em) AS ultimo
       FROM lancamentos l JOIN usuarios u ON u.id = l.usuario_id
       WHERE l.papel = @tipo AND l.criado_em >= @inicio AND (@fim IS NULL OR l.criado_em < @fim)
       GROUP BY u.id
       HAVING SUM(l.pontos) >= @minimo
       ORDER BY total DESC, ultimo ASC, u.id ASC
       LIMIT @limite`,
    )
    .all({ tipo, inicio, fim, minimo, limite: limite ?? r.ranking.tamanho });
  return {
    periodo,
    tipo,
    inicio,
    fim,
    minimo,
    pessoas: linhas.map((l, i) => ({ posicao: i + 1, id: l.id, nome: l.nome, usuario: l.usuario, pontos: l.total })),
  };
}

/** Posição e pontos de uma pessoa num ranking, ou null se ela não aparece nele. */
export function posicaoNoRanking(ctx, usuarioId, { periodo, tipo }) {
  const { pessoas } = calcularRanking(ctx, { periodo, tipo, limite: -1 });
  const achou = pessoas.find((p) => p.id === usuarioId);
  return achou ? { posicao: achou.posicao, pontos: achou.pontos } : null;
}
