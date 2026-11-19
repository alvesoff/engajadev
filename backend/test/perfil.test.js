import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente, HORA, DIA } from './ajuda.js';

const COMENTARIO = 'Comentário caprichado sobre o post, com detalhes.';

describe('perfil público', () => {
  let amb, ana, bia, caio;
  before(async () => {
    amb = await criarAmbiente({ regras: { ranking: { limiarTopGeral: 3 } } });
    ana = await amb.pessoa('ana');
    bia = await amb.pessoa('bia');
    caio = await amb.pessoa('caio');
    const p1 = await amb.postar(ana, { titulo: 'Primeiro post da Ana' });
    const p2 = await amb.postar(ana, { titulo: 'Segundo post da Ana' });
    await bia.post(`/api/posts/${p1}/comentarios`, { texto: COMENTARIO }); // bia 3, ana 2
    await bia.post(`/api/posts/${p2}/curtida`); // bia 1, ana 1
    await caio.post(`/api/posts/${p2}/curtida`); // caio 1, ana 1
  });
  after(() => amb.fechar());

  test('é público (não precisa entrar) e aceita @ no endereço', async () => {
    const r = await amb.cliente().get('/api/usuarios/@ana');
    assert.equal(r.status, 200);
    assert.equal(r.body.usuario.usuario, 'ana');
    assert.equal(r.body.usuario.nome, 'Ana');
  });

  test('não mostra e-mail nem senha', async () => {
    const r = await amb.cliente().get('/api/usuarios/ana');
    assert.ok(!r.texto.includes('@exemplo.com'));
    assert.ok(!r.texto.includes('senha'));
  });

  test('mostra os posts da pessoa, do mais novo para o mais antigo', async () => {
    const r = await amb.cliente().get('/api/usuarios/ana');
    assert.deepEqual(r.body.posts.map((p) => p.titulo), ['Segundo post da Ana', 'Primeiro post da Ana']);
    assert.equal(r.body.posts[0].curtidas, 2);
  });

  test('mostra os pontos e os números', async () => {
    const r = await amb.cliente().get('/api/usuarios/ana');
    assert.deepEqual(r.body.pontos, { total: 4, semana: 4, porPapel: { engajador: 0, criador: 4 } });
    assert.deepEqual(r.body.numeros, {
      posts: 2,
      curtidasRecebidas: 2,
      comentariosRecebidos: 1,
      curtidasFeitas: 0,
      comentariosFeitos: 0,
    });
  });

  test('mostra a posição nos rankings (null quando não aparece)', async () => {
    const ana_ = await amb.cliente().get('/api/usuarios/ana');
    assert.deepEqual(ana_.body.posicoes.semana.criador, { posicao: 1, pontos: 4 });
    assert.deepEqual(ana_.body.posicoes.geral.criador, { posicao: 1, pontos: 4 });
    assert.equal(ana_.body.posicoes.semana.engajador, null);

    const caio_ = await amb.cliente().get('/api/usuarios/caio');
    assert.deepEqual(caio_.body.posicoes.semana.engajador, { posicao: 2, pontos: 1 });
    assert.equal(caio_.body.posicoes.geral.engajador, null); // abaixo do limiar (3)
  });

  test('quando a semana vira, a posição da semana some e o total fica', async () => {
    amb.relogio.avancar(3 * DIA + 12 * HORA);
    const r = await amb.cliente().get('/api/usuarios/ana');
    assert.equal(r.body.posicoes.semana.criador, null);
    assert.equal(r.body.pontos.semana, 0);
    assert.equal(r.body.pontos.total, 4);
    assert.deepEqual(r.body.posicoes.geral.criador, { posicao: 1, pontos: 4 });
  });

  test('pessoa que não existe dá 404 em português', async () => {
    const r = await amb.cliente().get('/api/usuarios/ninguem');
    assert.equal(r.status, 404);
    assert.equal(r.body.erro, 'Pessoa não encontrada.');
  });
});
