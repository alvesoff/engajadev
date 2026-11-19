/**
 * Motor de pontuação. Cada ação vira lançamentos no livro-razão (tabela `lancamentos`):
 * um para quem engajou (papel "engajador") e um para o autor do post (papel "criador").
 */

/** Grava um lançamento. Devolve quantos pontos entraram. */
export function lancar(ctx, { usuarioId, tipo, papel, pontos, postId = null, refTipo = null, refId = null }) {
  const valor = Math.max(0, Math.trunc(Number(pontos) || 0));
  if (valor > 0) {
    ctx.db
      .prepare(
        `INSERT INTO lancamentos (usuario_id, tipo, papel, pontos, post_id, ref_tipo, ref_id, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(usuarioId, tipo, papel, valor, postId, refTipo, refId, ctx.agora());
  }
  return valor;
}

/** Apaga os lançamentos de uma ação desfeita (ex.: descurtir). */
export function estornar(ctx, refTipo, refId) {
  ctx.db.prepare('DELETE FROM lancamentos WHERE ref_tipo = ? AND ref_id = ?').run(refTipo, refId);
}

/** Curtida: pontos para quem curtiu e para o autor do post. */
export function pontuarCurtida(ctx, { curtida, post }) {
  const r = ctx.regras();
  const base = { postId: post.id, refTipo: 'curtida', refId: curtida.id };
  const engajador = lancar(ctx, { ...base, usuarioId: curtida.usuario_id, tipo: 'curtir', papel: 'engajador', pontos: r.pontos.curtir });
  const criador = lancar(ctx, {
    ...base,
    usuarioId: post.usuario_id,
    tipo: 'curtida_recebida',
    papel: 'criador',
    pontos: r.pontos.curtidaRecebida,
  });
  return { engajador, criador };
}

/** Comentário: pontos para quem comentou e para o autor do post. */
export function pontuarComentario(ctx, { comentario, post }) {
  const r = ctx.regras();
  const base = { postId: post.id, refTipo: 'comentario', refId: comentario.id };
  const engajador = lancar(ctx, {
    ...base,
    usuarioId: comentario.usuario_id,
    tipo: 'comentar',
    papel: 'engajador',
    pontos: r.pontos.comentar,
  });
  const criador = lancar(ctx, {
    ...base,
    usuarioId: post.usuario_id,
    tipo: 'comentario_recebido',
    papel: 'criador',
    pontos: r.pontos.comentarioRecebido,
  });
  return { engajador, criador };
}

/** Publicar um post (0 pontos por padrão). */
export function pontuarPublicacao(ctx, { post }) {
  const r = ctx.regras();
  const criador = lancar(ctx, {
    usuarioId: post.usuario_id,
    tipo: 'publicar',
    papel: 'criador',
    pontos: r.pontos.publicarPost,
    postId: post.id,
    refTipo: 'post',
    refId: post.id,
  });
  return { engajador: 0, criador };
}
