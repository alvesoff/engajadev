import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente, HORA, DIA } from './ajuda.js';

const COMENTARIO = 'Comentário caprichado sobre o post, com detalhes.';

describe('carteira de pontos', () => {
  let amb, ana, bia, p1;
  before(async () => {
    amb = await criarAmbiente();
    ana = await amb.pessoa('ana');
    bia = await amb.pessoa('bia');
    p1 = await amb.postar(ana);
    await bia.post(`/api/posts/${p1}/curtida`); // bia +1, ana +1
    await bia.post(`/api/posts/${p1}/comentarios`, { texto: COMENTARIO }); // bia +3, ana +2
  });
  after(() => amb.fechar());

  test('exige login', async () => {
    const r = await amb.cliente().get('/api/carteira');
    assert.equal(r.status, 401);
  });

  test('mostra saldo, divisão por papel, semana e hoje', async () => {
    const r = await bia.get('/api/carteira');
    assert.equal(r.status, 200);
    assert.equal(r.body.saldo, 4);
    assert.deepEqual(r.body.porPapel, { engajador: 4, criador: 0 });
    assert.equal(r.body.semana, 4);
    assert.deepEqual(r.body.hoje, { engajador: 4, criador: 0 });
    const a = await ana.get('/api/carteira');
    assert.equal(a.body.saldo, 3);
    assert.deepEqual(a.body.porPapel, { engajador: 0, criador: 3 });
  });

  test('extrato do mais novo para o mais antigo, com o título do post', async () => {
    const r = await bia.get('/api/carteira');
    assert.deepEqual(
      r.body.extrato.map((l) => `${l.tipo}:${l.pontos}`),
      ['comentar:3', 'curtir:1'],
    );
    assert.equal(r.body.extrato[0].post.id, p1);
    assert.match(r.body.extrato[0].post.titulo, /^Post /);
    const pag = await bia.get(`/api/carteira?limite=1&antes=${r.body.extrato[0].id}`);
    assert.deepEqual(pag.body.extrato.map((l) => l.tipo), ['curtir']);
  });

  test('o dia vira e o "hoje" zera, mas o saldo fica', async () => {
    amb.relogio.avancar(DIA);
    const r = await bia.get('/api/carteira');
    assert.deepEqual(r.body.hoje, { engajador: 0, criador: 0 });
    assert.equal(r.body.saldo, 4);
  });

  test('a semana vira: o ranking da semana zera, a carteira não', async () => {
    amb.relogio.avancar(3 * DIA + 12 * HORA); // passa da segunda 00:00
    const ranking = await amb.cliente().get('/api/rankings?periodo=semana&tipo=engajador');
    assert.deepEqual(ranking.body.pessoas, []);
    const r = await bia.get('/api/carteira');
    assert.equal(r.body.semana, 0);
    assert.equal(r.body.saldo, 4);
  });

  test('pontos novos somam no saldo de sempre', async () => {
    const p2 = await amb.postar(ana);
    await bia.post(`/api/posts/${p2}/curtida`);
    const r = await bia.get('/api/carteira');
    assert.equal(r.body.saldo, 5);
    assert.equal(r.body.semana, 1);
  });
});
