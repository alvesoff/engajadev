import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente, HORA } from './ajuda.js';

describe('editar o próprio post', () => {
  let amb;
  let ana;
  let bia;
  let post;
  before(async () => {
    amb = await criarAmbiente({ admins: ['chefe@exemplo.com'] });
    ana = await amb.pessoa('ana');
    bia = await amb.pessoa('bia');
    post = await amb.postar(bia, { url: 'https://dev.to/bia/post', titulo: 'Titlo com erro' });
    await ana.post(`/api/posts/${post}/curtida`);
  });
  after(() => amb.fechar());

  test('o autor corrige título e descrição; curtidas e pontos continuam; aparece como editado', async () => {
    const pontos = { ana: amb.pontosDe(ana.id), bia: amb.pontosDe(bia.id) };
    assert.equal((await bia.get(`/api/posts/${post}`)).body.post.editadoEm, null);
    amb.relogio.avancar(HORA);
    const r = await bia.put(`/api/posts/${post}`, { titulo: '  Título corrigido  ', descricao: 'Agora com descrição.' });
    assert.equal(r.status, 200);
    assert.equal(r.body.post.titulo, 'Título corrigido');
    assert.equal(r.body.post.descricao, 'Agora com descrição.');
    assert.equal(r.body.post.curtidas, 1);
    assert.equal(r.body.post.url, 'https://dev.to/bia/post');
    assert.ok(r.body.post.editadoEm > r.body.post.criadoEm);
    const feed = (await ana.get('/api/posts')).body.posts;
    assert.equal(feed[0].titulo, 'Título corrigido');
    assert.deepEqual(amb.pontosDe(ana.id), pontos.ana);
    assert.deepEqual(amb.pontosDe(bia.id), pontos.bia);
  });

  test('salvar sem mudar nada não marca como editado de novo', async () => {
    const antes = (await bia.get(`/api/posts/${post}`)).body.post.editadoEm;
    amb.relogio.avancar(HORA);
    const r = await bia.put(`/api/posts/${post}`, { titulo: 'Título corrigido', descricao: 'Agora com descrição.' });
    assert.equal(r.body.post.editadoEm, antes);
  });

  test('valida como ao publicar, e o link não pode ser trocado', async () => {
    const curto = await bia.put(`/api/posts/${post}`, { titulo: 'Oi' });
    assert.equal(curto.status, 400);
    assert.equal(curto.body.campo, 'titulo');
    const longa = await bia.put(`/api/posts/${post}`, { titulo: 'Título ok', descricao: 'x'.repeat(501) });
    assert.equal(longa.status, 400);
    assert.equal(longa.body.campo, 'descricao');
    const link = await bia.put(`/api/posts/${post}`, { titulo: 'Título ok', url: 'https://dev.to/bia/outro' });
    assert.equal(link.status, 400);
    assert.equal(link.body.erro, 'O link do post não pode ser trocado. Para divulgar outro link, publique um post novo.');
    // mandar o mesmo link junto não atrapalha
    assert.equal((await bia.put(`/api/posts/${post}`, { titulo: 'Título ok', url: 'https://dev.to/bia/post' })).status, 200);
    assert.equal((await bia.get(`/api/posts/${post}`)).body.post.url, 'https://dev.to/bia/post');
  });

  test('só o autor edita (nem o admin); post removido não se edita', async () => {
    const chefe = await amb.pessoa('chefe');
    assert.equal((await ana.put(`/api/posts/${post}`, { titulo: 'Invasão' })).status, 403);
    const doAdmin = await chefe.put(`/api/posts/${post}`, { titulo: 'Invasão' });
    assert.equal(doAdmin.status, 403);
    assert.equal(doAdmin.body.erro, 'Só quem publicou pode editar este post.');
    assert.equal((await amb.cliente().put(`/api/posts/${post}`, { titulo: 'Invasão' })).status, 401);

    const outro = await amb.postar(bia, { titulo: 'Vai sumir' });
    await bia.del(`/api/posts/${outro}`);
    assert.equal((await bia.put(`/api/posts/${outro}`, { titulo: 'Voltei' })).status, 404);
  });
});
