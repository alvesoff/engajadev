import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente } from './ajuda.js';

describe('segurança da API', () => {
  let amb;
  let ana;
  let bia;
  let postBia;
  before(async () => {
    amb = await criarAmbiente();
    ana = await amb.pessoa('ana');
    bia = await amb.pessoa('bia');
    postBia = await amb.postar(bia);
  });
  after(() => amb.fechar());

  test('toda resposta da API vem com cabeçalhos de segurança e sem cache', async () => {
    for (const r of [await ana.get('/api/auth/eu'), await amb.cliente().get('/api/rota-que-nao-existe')]) {
      assert.equal(r.headers.get('cache-control'), 'no-store');
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(r.headers.get('x-frame-options'), 'DENY');
      assert.equal(r.headers.get('referrer-policy'), 'same-origin');
      assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
      assert.equal(r.headers.get('x-powered-by'), null);
    }
  });

  test('pedido que muda dados vindo de outro site é bloqueado (CSRF)', async () => {
    for (const site of ['cross-site', 'same-site']) {
      const cab = { cabecalhos: { 'sec-fetch-site': site } };
      const curtir = await ana.post(`/api/posts/${postBia}/curtida`, {}, cab);
      assert.equal(curtir.status, 403);
      assert.equal(curtir.body.erro, 'Pedido bloqueado: ele veio de outro site.');
      assert.equal((await ana.post('/api/posts', { url: 'https://dev.to/x/y', titulo: 'Ataque' }, cab)).status, 403);
      assert.equal((await ana.del(`/api/posts/${postBia}/curtida`, cab)).status, 403);
      assert.equal((await ana.post('/api/auth/sair', {}, cab)).status, 403);
    }
    // nada foi gravado
    assert.deepEqual(amb.pontosDe(ana.id), { engajador: 0, criador: 0 });
    assert.equal((await ana.get('/api/auth/eu')).status, 200);
  });

  test('pedido da própria tela (mesma origem) e leitura de outro site continuam funcionando', async () => {
    const mesma = await ana.post(`/api/posts/${postBia}/curtida`, {}, { cabecalhos: { 'sec-fetch-site': 'same-origin' } });
    assert.equal(mesma.status, 200);
    const leitura = await amb.cliente().get('/api/rankings', { cabecalhos: { 'sec-fetch-site': 'cross-site' } });
    assert.equal(leitura.status, 200);
  });
});
