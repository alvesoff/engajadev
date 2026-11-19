/**
 * Motor de pontuação. Cada ação vira lançamentos no livro-razão (tabela `lancamentos`):
 * um para quem engajou (papel "engajador") e um para o autor do post (papel "criador").
 *
 * Regras anti-gaming:
 * - limite diário de pontos, separado para engajador e criador;
 * - cooldown (tempo mínimo) entre duas curtidas ou comentários da mesma pessoa;
 * - comentar vale mais que curtir (nos valores padrão);
 * - curtir ou comentar o próprio post não pontua;
 * - comentário curto demais não pontua, e só os primeiros N comentários por post pontuam;
 * - limite de posts por dia.
 */
import { erro } from './erros.js';
import { inicioDoDia } from './tempo.js';

const LIMITE_POR_PAPEL = { engajador: 'pontosDiariosEngajador', criador: 'pontosDiariosCriador' };
const ZERO = { pontos: 0, cortado: false };

/** Pontos que a pessoa ainda pode ganhar hoje num papel (Infinity se não há limite). */
export function restanteHoje(ctx, usuarioId, papel) {
  const r = ctx.regras();
  const limite = Number(r.limites[LIMITE_POR_PAPEL[papel]]) || 0;
  if (limite <= 0) return Infinity;
  const hoje = inicioDoDia(ctx.agora(), r.periodo.fusoHorarioMinutos);
  const { s } = ctx.db
    .prepare('SELECT COALESCE(SUM(pontos), 0) AS s FROM lancamentos WHERE usuario_id = ? AND papel = ? AND criado_em >= ?')
    .get(usuarioId, papel, hoje);
  return Math.max(0, limite - s);
}

/** Grava um lançamento, cortado pelo limite diário do papel. Devolve { pontos, cortado }. */
export function lancar(ctx, { usuarioId, tipo, papel, pontos, postId = null, refTipo = null, refId = null }) {
  const pedido = Math.max(0, Math.trunc(Number(pontos) || 0));
  if (pedido <= 0) return ZERO;
  const valor = Math.min(pedido, restanteHoje(ctx, usuarioId, papel));
  if (valor > 0) {
    ctx.db
      .prepare(
        `INSERT INTO lancamentos (usuario_id, tipo, papel, pontos, post_id, ref_tipo, ref_id, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(usuarioId, tipo, papel, valor, postId, refTipo, refId, ctx.agora());
  }
  return { pontos: valor, cortado: valor < pedido };
}

/** Apaga os lançamentos de uma ação desfeita (ex.: descurtir). */
export function estornar(ctx, refTipo, refId) {
  ctx.db.prepare('DELETE FROM lancamentos WHERE ref_tipo = ? AND ref_id = ?').run(refTipo, refId);
}

/** Cooldown: barra uma curtida ou comentário antes do tempo mínimo desde a última ação. */
export function conferirCooldown(ctx, usuarioId) {
  const r = ctx.regras();
  const espera = Math.max(0, Number(r.limites.cooldownSegundos) || 0) * 1000;
  if (!espera) return;
  const { ultima } = ctx.db
    .prepare(
      `SELECT MAX(t) AS ultima FROM (
         SELECT MAX(criado_em) AS t FROM curtidas WHERE usuario_id = @id
         UNION ALL SELECT MAX(criado_em) FROM comentarios WHERE usuario_id = @id)`,
    )
    .get({ id: usuarioId });
  const passou = ctx.agora() - (ultima ?? -Infinity);
  if (passou < espera) {
    const faltam = Math.ceil((espera - passou) / 1000);
    throw erro(429, `Calma! Espere ${faltam} ${faltam === 1 ? 'segundo' : 'segundos'} antes da próxima curtida ou comentário.`, {
      esperarSegundos: faltam,
      motivo: 'cooldown',
    });
  }
}

/** Limite de posts por dia. */
export function conferirLimitePosts(ctx, usuarioId) {
  const r = ctx.regras();
  const limite = Number(r.limites.postsPorDia) || 0;
  if (!limite) return;
  const hoje = inicioDoDia(ctx.agora(), r.periodo.fusoHorarioMinutos);
  const { n } = ctx.db.prepare('SELECT COUNT(*) AS n FROM posts WHERE usuario_id = ? AND criado_em >= ?').get(usuarioId, hoje);
  if (n >= limite) {
    throw erro(429, `Você já divulgou ${limite} ${limite === 1 ? 'post' : 'posts'} hoje. Volte amanhã!`, { motivo: 'limite_posts' });
  }
}

function resultado(eng, cri) {
  const out = { engajador: eng.pontos, criador: cri.pontos };
  if (eng.cortado) out.motivo = 'limite_diario_engajador';
  else if (cri.cortado) out.motivo = 'limite_diario_criador';
  return out;
}

// Se o limite diário de quem engajou zerou a ação, o autor também não ganha:
// evita usar contas que já bateram o limite só para alimentar o post de alguém.
const travadoPeloLimite = (eng) => eng.cortado && eng.pontos === 0;

/** Curtida: pontos para quem curtiu e para o autor do post. */
export function pontuarCurtida(ctx, { curtida, post }) {
  const r = ctx.regras();
  if (curtida.usuario_id === post.usuario_id) return { engajador: 0, criador: 0, motivo: 'proprio_post' };
  const base = { postId: post.id, refTipo: 'curtida', refId: curtida.id };
  const eng = lancar(ctx, { ...base, usuarioId: curtida.usuario_id, tipo: 'curtir', papel: 'engajador', pontos: r.pontos.curtir });
  const cri = travadoPeloLimite(eng)
    ? ZERO
    : lancar(ctx, { ...base, usuarioId: post.usuario_id, tipo: 'curtida_recebida', papel: 'criador', pontos: r.pontos.curtidaRecebida });
  return resultado(eng, cri);
}

/** Comentário: pontos para quem comentou e para o autor do post. */
export function pontuarComentario(ctx, { comentario, post }) {
  const r = ctx.regras();
  if (comentario.usuario_id === post.usuario_id) return { engajador: 0, criador: 0, motivo: 'proprio_post' };
  const minimo = Number(r.limites.comentarioMinCaracteres) || 0;
  if (comentario.texto.length < minimo) return { engajador: 0, criador: 0, motivo: 'comentario_curto' };
  const maxPorPost = Number(r.limites.comentariosPontuadosPorPost) || 0;
  if (maxPorPost) {
    const { n } = ctx.db
      .prepare(`SELECT COUNT(*) AS n FROM lancamentos WHERE usuario_id = ? AND post_id = ? AND tipo = 'comentar'`)
      .get(comentario.usuario_id, post.id);
    if (n >= maxPorPost) return { engajador: 0, criador: 0, motivo: 'limite_comentarios_post' };
  }
  const base = { postId: post.id, refTipo: 'comentario', refId: comentario.id };
  const eng = lancar(ctx, { ...base, usuarioId: comentario.usuario_id, tipo: 'comentar', papel: 'engajador', pontos: r.pontos.comentar });
  const cri = travadoPeloLimite(eng)
    ? ZERO
    : lancar(ctx, {
        ...base,
        usuarioId: post.usuario_id,
        tipo: 'comentario_recebido',
        papel: 'criador',
        pontos: r.pontos.comentarioRecebido,
      });
  return resultado(eng, cri);
}

/** Publicar um post (0 pontos por padrão). */
export function pontuarPublicacao(ctx, { post }) {
  const r = ctx.regras();
  const cri = lancar(ctx, {
    usuarioId: post.usuario_id,
    tipo: 'publicar',
    papel: 'criador',
    pontos: r.pontos.publicarPost,
    postId: post.id,
    refTipo: 'post',
    refId: post.id,
  });
  return resultado(ZERO, cri);
}
