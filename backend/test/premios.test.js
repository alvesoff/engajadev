import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente, DIA, HORA } from './ajuda.js';

const COMENTARIO = 'Comentário caprichado sobre o post, com detalhes.';
const ADMIN = 'chefe@exemplo.com';

/** Ambiente com admin, Ana (que vai juntar pontos) e Bia (autora dos posts). */
async function montar({ pontosAna = 4 } = {}) {
  const amb = await criarAmbiente({ admins: [ADMIN], regras: { limites: { comentariosPontuadosPorPost: 0 } } });
  const chefe = await amb.pessoa('chefe');
  const ana = await amb.pessoa('ana');
  const bia = await amb.pessoa('bia');
  const postBia = await amb.postar(bia);
  // cada comentário da Ana vale 3; uma curtida vale 1
  for (let i = 0; i < Math.floor(pontosAna / 3); i++) {
    await ana.post(`/api/posts/${postBia}/comentarios`, { texto: COMENTARIO });
  }
  if (pontosAna % 3) await ana.post(`/api/posts/${postBia}/curtida`);
  const criar = async (dados) => {
    const r = await chefe.post('/api/admin/premios', dados);
    if (r.status !== 201) throw new Error(r.texto);
    return r.body;
  };
  return { amb, chefe, ana, bia, postBia, criar };
}

describe('catálogo de prêmios (admin)', () => {
  let m;
  before(async () => (m = await montar({ pontosAna: 0 })));
  after(() => m.amb.fechar());

  test('só admin cria prêmios', async () => {
    assert.equal((await m.amb.cliente().post('/api/admin/premios', {})).status, 401);
    const r = await m.ana.post('/api/admin/premios', { nome: 'Caneca', custo: 10 });
    assert.equal(r.status, 403);
    assert.equal(r.body.erro, 'Só quem administra pode cuidar dos prêmios.');
  });

  test('admin cria, edita e desativa; o catálogo público só mostra os ativos', async () => {
    const caneca = await m.criar({ nome: 'Caneca EngajaDev', descricao: 'Caneca de cerâmica.', custo: 50, estoque: 10 });
    assert.deepEqual(
      { nome: caneca.nome, custo: caneca.custo, estoque: caneca.estoque, tipo: caneca.tipo, ativo: caneca.ativo },
      { nome: 'Caneca EngajaDev', custo: 50, estoque: 10, tipo: 'brinde', ativo: true },
    );
    const adesivo = await m.criar({ nome: 'Adesivos', custo: '20' });
    assert.equal(adesivo.estoque, null); // sem limite

    const editado = await m.chefe.put(`/api/admin/premios/${caneca.id}`, { custo: 60 });
    assert.equal(editado.body.custo, 60);
    assert.equal(editado.body.nome, 'Caneca EngajaDev');

    await m.chefe.put(`/api/admin/premios/${adesivo.id}`, { ativo: false });
    const publico = await m.amb.cliente().get('/api/premios');
    assert.deepEqual(publico.body.premios.map((p) => p.nome), ['Caneca EngajaDev']);
    const todos = await m.chefe.get('/api/admin/premios');
    assert.equal(todos.body.premios.length, 2);
  });

  test('valida o prêmio com mensagens em português', async () => {
    const casos = [
      [{ nome: 'ab', custo: 10 }, 'O nome do prêmio deve ter de 3 a 80 caracteres.'],
      [{ nome: 'Caneca', custo: 0 }, 'O custo deve ser um número inteiro de 1 a 1000000 pontos.'],
      [{ nome: 'Caneca', custo: 2.5 }, 'O custo deve ser um número inteiro de 1 a 1000000 pontos.'],
      [{ nome: 'Caneca', custo: 10, estoque: -1 }, 'O estoque deve ser um número inteiro de 0 a 1000000, ou vazio para sem limite.'],
      [{ nome: 'Caneca', custo: 10, tipo: 'dinheiro' }, 'Tipo inválido. Use "brinde" ou "destaque".'],
      [{ nome: 'Destaque', custo: 10, tipo: 'destaque' }, 'Diga por quantos dias o post fica em destaque (de 1 a 30).'],
    ];
    for (const [corpo, mensagem] of casos) {
      const r = await m.chefe.post('/api/admin/premios', corpo);
      assert.equal(r.status, 400, JSON.stringify(corpo));
      assert.equal(r.body.erro, mensagem);
    }
  });
});

describe('resgatar um brinde', () => {
  test('desconta da carteira, baixa o estoque e fica pendente', async () => {
    const m = await montar({ pontosAna: 10 });
    try {
      const caneca = await m.criar({ nome: 'Caneca EngajaDev', custo: 6, estoque: 2 });
      const r = await m.ana.post(`/api/premios/${caneca.id}/resgatar`);
      assert.equal(r.status, 201);
      assert.equal(r.body.saldo, 4);
      assert.equal(r.body.resgate.status, 'pendente');
      assert.equal(r.body.resgate.custo, 6);

      const carteira = await m.ana.get('/api/carteira');
      assert.deepEqual([carteira.body.saldo, carteira.body.totalGanho, carteira.body.resgatado], [4, 10, 6]);
      assert.equal(carteira.body.resgates[0].premio.nome, 'Caneca EngajaDev');
      assert.equal((await m.amb.cliente().get('/api/premios')).body.premios[0].estoque, 1);
    } finally {
      await m.amb.fechar();
    }
  });

  test('saldo curto: diz quantos pontos faltam e não grava nada', async () => {
    const m = await montar({ pontosAna: 4 });
    try {
      const camiseta = await m.criar({ nome: 'Camiseta', custo: 10, estoque: 5 });
      const r = await m.ana.post(`/api/premios/${camiseta.id}/resgatar`);
      assert.equal(r.status, 400);
      assert.equal(r.body.erro, 'Faltam 6 pontos para este prêmio.');
      assert.equal(r.body.faltam, 6);
      assert.equal((await m.ana.get('/api/carteira')).body.saldo, 4);
      assert.equal((await m.amb.cliente().get('/api/premios')).body.premios[0].estoque, 5);
    } finally {
      await m.amb.fechar();
    }
  });

  test('não dá para gastar os mesmos pontos duas vezes, nem com pedidos ao mesmo tempo', async () => {
    const m = await montar({ pontosAna: 10 });
    try {
      const caneca = await m.criar({ nome: 'Caneca', custo: 6 });
      const [a, b] = await Promise.all([
        m.ana.post(`/api/premios/${caneca.id}/resgatar`),
        m.ana.post(`/api/premios/${caneca.id}/resgatar`),
      ]);
      assert.deepEqual([a.status, b.status].sort(), [201, 400]);
      assert.equal((await m.ana.get('/api/carteira')).body.saldo, 4);
    } finally {
      await m.amb.fechar();
    }
  });

  test('estoque esgotado', async () => {
    const m = await montar({ pontosAna: 10 });
    try {
      const unico = await m.criar({ nome: 'Mentoria', custo: 3, estoque: 1 });
      assert.equal((await m.ana.post(`/api/premios/${unico.id}/resgatar`)).status, 201);
      const r = await m.ana.post(`/api/premios/${unico.id}/resgatar`);
      assert.equal(r.status, 409);
      assert.equal(r.body.erro, 'Este prêmio acabou. Escolha outro.');
    } finally {
      await m.amb.fechar();
    }
  });

  test('prêmio inativo ou inexistente dá 404; resgatar exige login', async () => {
    const m = await montar({ pontosAna: 10 });
    try {
      const p = await m.criar({ nome: 'Antigo', custo: 1, ativo: false });
      assert.equal((await m.ana.post(`/api/premios/${p.id}/resgatar`)).status, 404);
      assert.equal((await m.ana.post('/api/premios/999/resgatar')).status, 404);
      assert.equal((await m.amb.cliente().post(`/api/premios/${p.id}/resgatar`)).status, 401);
    } finally {
      await m.amb.fechar();
    }
  });

  test('resgatar NÃO muda rankings, perfil nem o limite de pontos de hoje', async () => {
    const m = await montar({ pontosAna: 10 });
    try {
      const antes = {
        semana: (await m.amb.cliente().get('/api/rankings?periodo=semana&tipo=engajador')).body.pessoas,
        geral: (await m.amb.cliente().get('/api/rankings?periodo=geral&tipo=engajador')).body.pessoas,
        perfil: (await m.amb.cliente().get('/api/usuarios/ana')).body.pontos,
        hoje: (await m.ana.get('/api/carteira')).body.hoje,
      };
      const caneca = await m.criar({ nome: 'Caneca', custo: 9 });
      await m.ana.post(`/api/premios/${caneca.id}/resgatar`);
      const depois = {
        semana: (await m.amb.cliente().get('/api/rankings?periodo=semana&tipo=engajador')).body.pessoas,
        geral: (await m.amb.cliente().get('/api/rankings?periodo=geral&tipo=engajador')).body.pessoas,
        perfil: (await m.amb.cliente().get('/api/usuarios/ana')).body.pontos,
        hoje: (await m.ana.get('/api/carteira')).body.hoje,
      };
      assert.deepEqual(depois, antes);
      assert.equal(depois.perfil.total, 10);
      assert.equal((await m.ana.get('/api/carteira')).body.saldo, 1);
    } finally {
      await m.amb.fechar();
    }
  });
});

describe('admin entrega ou cancela o resgate', () => {
  test('entregar; cancelar devolve pontos e estoque uma vez só', async () => {
    const m = await montar({ pontosAna: 10 });
    try {
      const caneca = await m.criar({ nome: 'Caneca', custo: 3, estoque: 5 });
      const r1 = (await m.ana.post(`/api/premios/${caneca.id}/resgatar`)).body.resgate;
      const r2 = (await m.ana.post(`/api/premios/${caneca.id}/resgatar`)).body.resgate;
      assert.equal((await m.ana.get('/api/carteira')).body.saldo, 4);

      const lista = await m.chefe.get('/api/admin/resgates?status=pendente');
      assert.equal(lista.body.resgates.length, 2);
      assert.equal(lista.body.resgates[0].usuario.email, 'ana@exemplo.com'); // para combinar a entrega

      const entregue = await m.chefe.put(`/api/admin/resgates/${r1.id}`, { status: 'entregue' });
      assert.equal(entregue.body.status, 'entregue');
      assert.equal((await m.ana.get('/api/carteira')).body.saldo, 4); // entregue continua gasto

      const cancelado = await m.chefe.put(`/api/admin/resgates/${r2.id}`, { status: 'cancelado' });
      assert.equal(cancelado.body.status, 'cancelado');
      assert.equal((await m.ana.get('/api/carteira')).body.saldo, 7);
      assert.equal((await m.amb.cliente().get('/api/premios')).body.premios[0].estoque, 4);

      const deNovo = await m.chefe.put(`/api/admin/resgates/${r2.id}`, { status: 'cancelado' });
      assert.equal(deNovo.status, 409);
      assert.equal(deNovo.body.erro, 'Este resgate já está cancelado.');
      assert.equal((await m.ana.get('/api/carteira')).body.saldo, 7);
      assert.equal((await m.amb.cliente().get('/api/premios')).body.premios[0].estoque, 4);

      const voltar = await m.chefe.put(`/api/admin/resgates/${r1.id}`, { status: 'cancelado' });
      assert.equal(voltar.status, 409);
      assert.equal(voltar.body.erro, 'Este resgate já está entregue.');

      const invalido = await m.chefe.put(`/api/admin/resgates/${r1.id}`, { status: 'sumiu' });
      assert.equal(invalido.status, 400);
      assert.equal((await m.ana.put(`/api/admin/resgates/${r1.id}`, { status: 'entregue' })).status, 403);
    } finally {
      await m.amb.fechar();
    }
  });

  test('a lista de resgates de quem não é admin não mostra e-mail', async () => {
    const m = await montar({ pontosAna: 10 });
    try {
      const caneca = await m.criar({ nome: 'Caneca', custo: 3 });
      await m.ana.post(`/api/premios/${caneca.id}/resgatar`);
      const c = await m.ana.get('/api/carteira');
      assert.equal(c.body.resgates[0].usuario.email, undefined);
    } finally {
      await m.amb.fechar();
    }
  });
});

describe('prêmio de destaque no feed', () => {
  test('destaca o próprio post por N dias e depois vence', async () => {
    const m = await montar({ pontosAna: 10 });
    try {
      const destaque = await m.criar({ nome: 'Post em destaque', custo: 5, tipo: 'destaque', diasDestaque: 2 });
      const postAna = await m.amb.postar(m.ana, { titulo: 'Post da Ana' });

      const semPost = await m.ana.post(`/api/premios/${destaque.id}/resgatar`);
      assert.equal(semPost.status, 400);
      assert.equal(semPost.body.erro, 'Escolha qual dos seus posts vai ficar em destaque.');
      const deOutro = await m.ana.post(`/api/premios/${destaque.id}/resgatar`, { postId: m.postBia });
      assert.equal(deOutro.status, 400);
      assert.equal(deOutro.body.erro, 'Você só pode destacar um post seu.');

      const r = await m.ana.post(`/api/premios/${destaque.id}/resgatar`, { postId: postAna });
      assert.equal(r.status, 201);
      assert.equal(r.body.resgate.status, 'entregue'); // destaque é entregue na hora
      assert.equal(r.body.resgate.post.titulo, 'Post da Ana');

      const feed = await m.amb.cliente().get('/api/posts');
      assert.deepEqual(feed.body.destaques.map((p) => p.titulo), ['Post da Ana']);
      // o feed normal continua igual (o destaque vem à parte)
      assert.deepEqual(feed.body.posts.map((p) => p.titulo), ['Post da Ana', 'Post 1']);
      const pagina2 = await m.amb.cliente().get(`/api/posts?antes=${feed.body.posts[0].id}`);
      assert.deepEqual(pagina2.body.destaques, []);

      const repetido = await m.ana.post(`/api/premios/${destaque.id}/resgatar`, { postId: postAna });
      assert.equal(repetido.status, 409);
      assert.equal(repetido.body.erro, 'Este post já está em destaque.');

      m.amb.relogio.avancar(2 * DIA - HORA);
      assert.equal((await m.amb.cliente().get('/api/posts')).body.destaques.length, 1);
      m.amb.relogio.avancar(HORA);
      assert.equal((await m.amb.cliente().get('/api/posts')).body.destaques.length, 0);
    } finally {
      await m.amb.fechar();
    }
  });
});
