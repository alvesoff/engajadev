import { inicioDoDia, janela } from './tempo.js';

/**
 * Carteira de pontos de prêmio. É separada do ranking: a semana zera, a carteira não.
 * Saldo = tudo o que a pessoa já ganhou. (O resgate de prêmios fica para a 2ª fase.)
 */
export function resumoCarteira(ctx, usuarioId) {
  const r = ctx.regras();
  const agora = ctx.agora();
  const hoje = inicioDoDia(agora, r.periodo.fusoHorarioMinutos);
  const semana = janela('semana', agora, r.periodo).inicio;
  const l = ctx.db
    .prepare(
      `SELECT
         COALESCE(SUM(pontos), 0) AS total,
         COALESCE(SUM(CASE WHEN papel = 'engajador' THEN pontos END), 0) AS total_engajador,
         COALESCE(SUM(CASE WHEN papel = 'criador' THEN pontos END), 0) AS total_criador,
         COALESCE(SUM(CASE WHEN criado_em >= @semana THEN pontos END), 0) AS semana,
         COALESCE(SUM(CASE WHEN criado_em >= @hoje AND papel = 'engajador' THEN pontos END), 0) AS hoje_engajador,
         COALESCE(SUM(CASE WHEN criado_em >= @hoje AND papel = 'criador' THEN pontos END), 0) AS hoje_criador
       FROM lancamentos WHERE usuario_id = @id`,
    )
    .get({ id: usuarioId, hoje, semana });
  return {
    saldo: l.total,
    porPapel: { engajador: l.total_engajador, criador: l.total_criador },
    semana: l.semana,
    hoje: { engajador: l.hoje_engajador, criador: l.hoje_criador },
  };
}

/** Extrato: os lançamentos mais recentes primeiro, paginado pelo id ("antes"). */
export function extrato(ctx, usuarioId, { antes, limite = 30 } = {}) {
  return ctx.db
    .prepare(
      `SELECT l.id, l.tipo, l.papel, l.pontos, l.criado_em, l.post_id, p.titulo
       FROM lancamentos l LEFT JOIN posts p ON p.id = l.post_id
       WHERE l.usuario_id = @id AND (@antes IS NULL OR l.id < @antes)
       ORDER BY l.id DESC LIMIT @limite`,
    )
    .all({
      id: usuarioId,
      antes: antes ? Number(antes) || 0 : null,
      limite: Math.min(Math.max(Number(limite) || 30, 1), 100),
    })
    .map((l) => ({
      id: l.id,
      tipo: l.tipo,
      papel: l.papel,
      pontos: l.pontos,
      criadoEm: l.criado_em,
      post: l.post_id ? { id: l.post_id, titulo: l.titulo } : null,
    }));
}
