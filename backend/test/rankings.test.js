import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente, MIN, HORA, DIA } from './ajuda.js';
import { inicioDaSemana } from '../src/tempo.js';

const COMENTARIO = 'Comentário caprichado sobre o post, com detalhes.';
const nomes = (r) => r.body.pessoas.map((p) => `${p.usuario}:${p.pontos}`);

describe('virada da semana', () => {
  const brasilia = { fusoHorarioMinutos: -180, inicioSemanaDia: 1, inicioSemanaHora: 0 };
  test('a semana começa na segunda 00:00 de Brasília (03:00 UTC)', () => {
    const quinta = Date.UTC(2026, 10, 19, 15, 0);
    assert.equal(inicioDaSemana(quinta, brasilia), Date.UTC(2026, 10, 16, 3, 0));
  });
  test('domingo 23:59 em Brasília ainda é a semana anterior', () => {
    const domingoNoite = Date.UTC(2026, 10, 23, 2, 59);
    assert.equal(inicioDaSemana(domingoNoite, brasilia), Date.UTC(2026, 10, 16, 3, 0));
  });
  test('dia e hora da virada mudam pela regra', () => {
    const quinta = Date.UTC(2026, 10, 19, 15, 0);
    // domingo 20:00 em Brasília = 23:00 UTC
    assert.equal(inicioDaSemana(quinta, { ...brasilia, inicioSemanaDia: 0, inicioSemanaHora: 20 }), Date.UTC(2026, 10, 15, 23, 0));
  });
});

describe('Top da Semana e Top Geral', () => {
  let amb, ana, bia, caio;
  before(async () => {
    amb = await criarAmbiente();
    ana = await amb.pessoa('ana');
    bia = await amb.pessoa('bia');
    caio = await amb.pessoa('caio');
    const postsAna = [await amb.postar(ana), await amb.postar(ana), await amb.postar(ana), await amb.postar(ana)];
    const postCaio = await amb.postar(caio);
    // Bia comenta nos 4 posts da Ana: 12 pontos de engajadora; Ana ganha 8 de criadora.
    for (const id of postsAna) await bia.post(`/api/posts/${id}/comentarios`, { texto: COMENTARIO });
    // Ana curte o post do Caio: 1 ponto para cada.
    await ana.post(`/api/posts/${postCaio}/curtida`);
  });
  after(() => amb.fechar());

  test('Top Engajador da semana', async () => {
    const r = await amb.cliente().get('/api/rankings?periodo=semana&tipo=engajador');
    assert.equal(r.status, 200);
    assert.deepEqual(nomes(r), ['bia:12', 'ana:1']);
    assert.equal(r.body.pessoas[0].posicao, 1);
  });

  test('Top Criador da semana', async () => {
    const r = await amb.cliente().get('/api/rankings?periodo=semana&tipo=criador');
    assert.deepEqual(nomes(r), ['ana:8', 'caio:1']);
  });

  test('padrão é semana + engajador', async () => {
    const r = await amb.cliente().get('/api/rankings');
    assert.equal(r.body.periodo, 'semana');
    assert.equal(r.body.tipo, 'engajador');
  });

  test('Top Geral lista só quem tem 10 pontos ou mais', async () => {
    const eng = await amb.cliente().get('/api/rankings?periodo=geral&tipo=engajador');
    assert.deepEqual(nomes(eng), ['bia:12']);
    assert.equal(eng.body.minimo, 10);
    const cri = await amb.cliente().get('/api/rankings?periodo=geral&tipo=criador');
    assert.deepEqual(nomes(cri), []);
  });

  test('o ranking atualiza na hora', async () => {
    const postCaio2 = await amb.postar(caio);
    await ana.post(`/api/posts/${postCaio2}/comentarios`, { texto: COMENTARIO });
    const r = await amb.cliente().get('/api/rankings?periodo=semana&tipo=engajador');
    assert.deepEqual(nomes(r), ['bia:12', 'ana:4']);
  });

  test('um minuto antes da virada a semana continua', async () => {
    amb.relogio.avancar(3 * DIA + 12 * HORA - MIN); // domingo 23:59 em Brasília
    const r = await amb.cliente().get('/api/rankings?periodo=semana&tipo=engajador');
    assert.deepEqual(nomes(r), ['bia:12', 'ana:4']);
  });

  test('na segunda 00:00 o Top da Semana zera, e o Top Geral continua', async () => {
    amb.relogio.avancar(MIN);
    const semana = await amb.cliente().get('/api/rankings?periodo=semana&tipo=engajador');
    assert.deepEqual(nomes(semana), []);
    const geral = await amb.cliente().get('/api/rankings?periodo=geral&tipo=engajador');
    assert.deepEqual(nomes(geral), ['bia:12']);
  });

  test('pontos da semana nova entram só na semana nova', async () => {
    const p = await amb.postar(bia);
    await caio.post(`/api/posts/${p}/curtida`);
    const r = await amb.cliente().get('/api/rankings?periodo=semana&tipo=engajador');
    assert.deepEqual(nomes(r), ['caio:1']);
  });

  test('período ou tipo inválido dá 400 em português', async () => {
    const a = await amb.cliente().get('/api/rankings?periodo=ano');
    assert.equal(a.status, 400);
    assert.equal(a.body.erro, 'Período inválido. Use "semana" ou "geral".');
    const b = await amb.cliente().get('/api/rankings?tipo=leitor');
    assert.equal(b.status, 400);
    assert.equal(b.body.erro, 'Tipo inválido. Use "engajador" ou "criador".');
  });
});

describe('limiar do Top Geral', () => {
  test('o limiar muda pela regra', async () => {
    const amb = await criarAmbiente({ regras: { ranking: { limiarTopGeral: 2 } } });
    try {
      const ana = await amb.pessoa('ana');
      const bia = await amb.pessoa('bia');
      const p = await amb.postar(ana);
      await bia.post(`/api/posts/${p}/comentarios`, { texto: COMENTARIO });
      const r = await amb.cliente().get('/api/rankings?periodo=geral&tipo=criador');
      assert.deepEqual(nomes(r), ['ana:2']);
      assert.equal(r.body.minimo, 2);
    } finally {
      await amb.fechar();
    }
  });

  test('empate: fica na frente quem chegou primeiro', async () => {
    const amb = await criarAmbiente();
    try {
      const ana = await amb.pessoa('ana');
      const bia = await amb.pessoa('bia');
      const caio = await amb.pessoa('caio');
      const p = await amb.postar(ana);
      await caio.post(`/api/posts/${p}/curtida`);
      amb.relogio.avancar(MIN);
      await bia.post(`/api/posts/${p}/curtida`);
      const r = await amb.cliente().get('/api/rankings?periodo=semana&tipo=engajador');
      assert.deepEqual(nomes(r), ['caio:1', 'bia:1']);
    } finally {
      await amb.fechar();
    }
  });
});
