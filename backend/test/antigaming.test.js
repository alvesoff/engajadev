import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente, HORA, DIA } from './ajuda.js';
import { PADRAO } from '../src/regras.js';

const COMENTARIO = 'Comentário caprichado sobre o post, com detalhes.';

async function comAmbiente(opcoes, fn) {
  const amb = await criarAmbiente(opcoes);
  try {
    await fn(amb);
  } finally {
    await amb.fechar();
  }
}

describe('anti-gaming', () => {
  test('comentar vale mais que curtir (padrão)', () => {
    assert.ok(PADRAO.pontos.comentar > PADRAO.pontos.curtir);
    assert.ok(PADRAO.pontos.comentarioRecebido > PADRAO.pontos.curtidaRecebida);
  });

  test('curtir e comentar o próprio post não pontua', () =>
    comAmbiente({}, async (amb) => {
      const ana = await amb.pessoa('ana');
      const p = await amb.postar(ana);
      const c = await ana.post(`/api/posts/${p}/curtida`);
      assert.deepEqual(c.body.pontos, { engajador: 0, criador: 0, motivo: 'proprio_post' });
      assert.equal(c.body.post.curtidas, 1); // a curtida conta no post, só não pontua
      const m = await ana.post(`/api/posts/${p}/comentarios`, { texto: COMENTARIO });
      assert.deepEqual(m.body.pontos, { engajador: 0, criador: 0, motivo: 'proprio_post' });
      assert.deepEqual(amb.pontosDe(ana.id), { engajador: 0, criador: 0 });
    }));

  test('cooldown: espera 10 segundos entre curtidas e comentários', () =>
    comAmbiente({ regras: { limites: { cooldownSegundos: 10 } } }, async (amb) => {
      const ana = await amb.pessoa('ana');
      const bia = await amb.pessoa('bia');
      const p1 = await amb.postar(ana);
      const p2 = await amb.postar(ana);
      assert.equal((await bia.post(`/api/posts/${p1}/curtida`)).status, 200);

      amb.relogio.avancar(4000);
      const barrado = await bia.post(`/api/posts/${p2}/curtida`);
      assert.equal(barrado.status, 429);
      assert.equal(barrado.body.erro, 'Calma! Espere 6 segundos antes da próxima curtida ou comentário.');
      assert.equal(barrado.body.motivo, 'cooldown');
      const comentarioBarrado = await bia.post(`/api/posts/${p2}/comentarios`, { texto: COMENTARIO });
      assert.equal(comentarioBarrado.status, 429);
      // nada foi gravado
      const post = await bia.get(`/api/posts/${p2}`);
      assert.equal(post.body.post.curtidas, 0);
      assert.equal(post.body.post.comentarios, 0);

      amb.relogio.avancar(6000);
      assert.equal((await bia.post(`/api/posts/${p2}/curtida`)).status, 200);
      assert.deepEqual(amb.pontosDe(bia.id), { engajador: 2, criador: 0 });
    }));

  test('o cooldown é de cada pessoa', () =>
    comAmbiente({ regras: { limites: { cooldownSegundos: 10 } } }, async (amb) => {
      const ana = await amb.pessoa('ana');
      const bia = await amb.pessoa('bia');
      const caio = await amb.pessoa('caio');
      const p = await amb.postar(ana);
      assert.equal((await bia.post(`/api/posts/${p}/curtida`)).status, 200);
      assert.equal((await caio.post(`/api/posts/${p}/curtida`)).status, 200);
    }));

  test('limite diário do engajador: passou, a ação acontece mas não pontua; no dia seguinte volta', () =>
    comAmbiente({ regras: { limites: { pontosDiariosEngajador: 7 } } }, async (amb) => {
      const ana = await amb.pessoa('ana');
      const bia = await amb.pessoa('bia');
      const posts = [];
      for (let i = 0; i < 4; i++) posts.push(await amb.postar(ana));
      const r1 = await bia.post(`/api/posts/${posts[0]}/comentarios`, { texto: COMENTARIO });
      const r2 = await bia.post(`/api/posts/${posts[1]}/comentarios`, { texto: COMENTARIO });
      const r3 = await bia.post(`/api/posts/${posts[2]}/comentarios`, { texto: COMENTARIO });
      assert.deepEqual(r1.body.pontos, { engajador: 3, criador: 2 });
      assert.deepEqual(r2.body.pontos, { engajador: 3, criador: 2 });
      // só cabia 1 ponto: entra 1 e o autor ganha normalmente
      assert.deepEqual(r3.body.pontos, { engajador: 1, criador: 2, motivo: 'limite_diario_engajador' });
      const r4 = await bia.post(`/api/posts/${posts[3]}/curtida`);
      assert.equal(r4.status, 200);
      assert.equal(r4.body.post.curtidas, 1);
      // limite zerado: nem quem curtiu nem o autor ganham
      assert.deepEqual(r4.body.pontos, { engajador: 0, criador: 0, motivo: 'limite_diario_engajador' });
      assert.deepEqual(amb.pontosDe(bia.id), { engajador: 7, criador: 0 });

      amb.relogio.avancar(DIA);
      const p5 = await amb.postar(ana);
      const r5 = await bia.post(`/api/posts/${p5}/curtida`);
      assert.deepEqual(r5.body.pontos, { engajador: 1, criador: 1 });
    }));

  test('o dia do limite vira à meia-noite de Brasília', () =>
    comAmbiente({ inicio: Date.UTC(2026, 10, 20, 2, 30), regras: { limites: { pontosDiariosEngajador: 1 } } }, async (amb) => {
      // 23:30 de quinta em Brasília
      const ana = await amb.pessoa('ana');
      const bia = await amb.pessoa('bia');
      const p1 = await amb.postar(ana);
      const p2 = await amb.postar(ana);
      const p3 = await amb.postar(ana);
      await bia.post(`/api/posts/${p1}/curtida`);
      const cheio = await bia.post(`/api/posts/${p2}/curtida`);
      assert.equal(cheio.body.pontos.engajador, 0);
      amb.relogio.avancar(HORA); // 00:30 de sexta em Brasília
      const novoDia = await bia.post(`/api/posts/${p3}/curtida`);
      assert.equal(novoDia.body.pontos.engajador, 1);
    }));

  test('limite diário do criador', () =>
    comAmbiente({ regras: { limites: { pontosDiariosCriador: 3 } } }, async (amb) => {
      const ana = await amb.pessoa('ana');
      const bia = await amb.pessoa('bia');
      const caio = await amb.pessoa('caio');
      const p = await amb.postar(ana);
      await bia.post(`/api/posts/${p}/comentarios`, { texto: COMENTARIO }); // ana +2
      const r = await caio.post(`/api/posts/${p}/comentarios`, { texto: COMENTARIO }); // ana só +1
      assert.deepEqual(r.body.pontos, { engajador: 3, criador: 1, motivo: 'limite_diario_criador' });
      assert.deepEqual(amb.pontosDe(ana.id), { engajador: 0, criador: 3 });
    }));

  test('comentário curto é publicado, mas não pontua', () =>
    comAmbiente({}, async (amb) => {
      const ana = await amb.pessoa('ana');
      const bia = await amb.pessoa('bia');
      const p = await amb.postar(ana);
      const r = await bia.post(`/api/posts/${p}/comentarios`, { texto: 'Top!' });
      assert.equal(r.status, 201);
      assert.deepEqual(r.body.pontos, { engajador: 0, criador: 0, motivo: 'comentario_curto' });
    }));

  test('só o primeiro comentário da pessoa no mesmo post pontua', () =>
    comAmbiente({}, async (amb) => {
      const ana = await amb.pessoa('ana');
      const bia = await amb.pessoa('bia');
      const p = await amb.postar(ana);
      const a = await bia.post(`/api/posts/${p}/comentarios`, { texto: COMENTARIO });
      const b = await bia.post(`/api/posts/${p}/comentarios`, { texto: COMENTARIO + ' De novo.' });
      assert.deepEqual(a.body.pontos, { engajador: 3, criador: 2 });
      assert.deepEqual(b.body.pontos, { engajador: 0, criador: 0, motivo: 'limite_comentarios_post' });
      assert.equal((await bia.get(`/api/posts/${p}`)).body.comentarios.length, 2);
    }));

  test('limite de 5 posts por dia', () =>
    comAmbiente({}, async (amb) => {
      const ana = await amb.pessoa('ana');
      for (let i = 0; i < 5; i++) await amb.postar(ana);
      const r = await ana.post('/api/posts', { url: 'https://dev.to/ana/sexto', titulo: 'Sexto post' });
      assert.equal(r.status, 429);
      assert.equal(r.body.erro, 'Você já divulgou 5 posts hoje. Volte amanhã!');
      amb.relogio.avancar(DIA);
      assert.equal((await ana.post('/api/posts', { url: 'https://dev.to/ana/sexto', titulo: 'Sexto post' })).status, 201);
    }));
});

describe('limite de contas novas por IP', () => {
  const dados = (n) => ({ nome: `Pessoa ${n}`, usuario: `pessoa${n}`, email: `pessoa${n}@exemplo.com`, senha: 'senha-forte-123' });

  test('passou do limite na hora: 429 com espera; depois de uma hora libera', async () => {
    const amb = await criarAmbiente({ regras: { limites: { cadastrosPorIpHora: 3 } } });
    try {
      for (let i = 1; i <= 3; i++) assert.equal((await amb.cliente().post('/api/auth/cadastro', dados(i))).status, 201);
      const r = await amb.cliente().post('/api/auth/cadastro', dados(4));
      assert.equal(r.status, 429);
      assert.equal(r.body.erro, 'Muitas contas criadas a partir desta rede. Espere 60 minutos e tente de novo.');
      assert.equal(r.headers.get('retry-after'), '3600');
      assert.equal(amb.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 3);

      amb.relogio.avancar(HORA);
      assert.equal((await amb.cliente().post('/api/auth/cadastro', dados(4))).status, 201);
    } finally {
      await amb.fechar();
    }
  });

  test('cadastro recusado (e-mail repetido) não gasta vaga; pedidos ao mesmo tempo não passam do limite', async () => {
    const amb = await criarAmbiente({ regras: { limites: { cadastrosPorIpHora: 2 } } });
    try {
      assert.equal((await amb.cliente().post('/api/auth/cadastro', dados(1))).status, 201);
      for (let i = 0; i < 3; i++) assert.equal((await amb.cliente().post('/api/auth/cadastro', dados(1))).status, 409);
      const juntos = await Promise.all([2, 3, 4].map((n) => amb.cliente().post('/api/auth/cadastro', dados(n))));
      assert.deepEqual(juntos.map((r) => r.status).sort(), [201, 429, 429]);
      assert.equal(amb.db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n, 2);
    } finally {
      await amb.fechar();
    }
  });

  test('0 = sem limite, e o admin muda o limite pela tela de regras', async () => {
    const amb = await criarAmbiente({ admins: ['chefe@exemplo.com'] });
    try {
      for (let i = 1; i <= 12; i++) assert.equal((await amb.cliente().post('/api/auth/cadastro', dados(i))).status, 201);
      const chefe = await amb.pessoa('chefe');
      assert.equal((await chefe.put('/api/admin/regras', { 'limites.cadastrosPorIpHora': 1 })).status, 200);
      assert.equal((await amb.cliente().post('/api/auth/cadastro', dados(99))).status, 429);
    } finally {
      await amb.fechar();
    }
  });
});
