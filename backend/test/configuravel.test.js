import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, utimesSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarAmbiente, MIN, DIA } from './ajuda.js';
import { PADRAO, CHAVES } from '../src/regras.js';

const COMENTARIO = 'Comentário caprichado sobre o post, com detalhes.';
const ADMIN = 'chefe@exemplo.com';

/** Arquivo de regras temporário; cada escrita ganha um horário novo para o leitor perceber. */
function arquivoTemporario(conteudo) {
  const arquivo = join(mkdtempSync(join(tmpdir(), 'engajadev-regras-')), 'regras.json');
  let versao = 0;
  const escrever = (obj) => {
    writeFileSync(arquivo, typeof obj === 'string' ? obj : JSON.stringify(obj));
    versao += 1;
    const t = new Date(Date.now() + versao * 1000);
    utimesSync(arquivo, t, t);
  };
  escrever(conteudo);
  return { arquivo, escrever };
}

async function comAmbiente(opcoes, fn) {
  const amb = await criarAmbiente(opcoes);
  try {
    await fn(amb);
  } finally {
    await amb.fechar();
  }
}

describe('regras por arquivo', () => {
  test('o config/regras.json do projeto é válido e igual ao padrão', () => {
    const aqui = dirname(fileURLToPath(import.meta.url));
    const arquivo = JSON.parse(readFileSync(join(aqui, '..', 'config', 'regras.json'), 'utf8'));
    for (const [grupo, valores] of Object.entries(PADRAO)) assert.deepEqual(arquivo[grupo], valores, grupo);
  });

  test('pontos por ação vêm do arquivo e mudam sem reiniciar', async () => {
    const { arquivo, escrever } = arquivoTemporario({ pontos: { curtir: 2, curtidaRecebida: 5 } });
    await comAmbiente({ arquivoRegras: arquivo }, async (amb) => {
      const ana = await amb.pessoa('ana');
      const bia = await amb.pessoa('bia');
      const p1 = await amb.postar(ana);
      const p2 = await amb.postar(ana);
      const r1 = await bia.post(`/api/posts/${p1}/curtida`);
      assert.deepEqual(r1.body.pontos, { engajador: 2, criador: 5 });

      escrever({ pontos: { curtir: 4 } });
      const r2 = await bia.post(`/api/posts/${p2}/curtida`);
      assert.deepEqual(r2.body.pontos, { engajador: 4, criador: 1 });
    });
  });

  test('cooldown, limite diário e limiar do Top Geral vêm do arquivo', async () => {
    const { arquivo } = arquivoTemporario({
      limites: { cooldownSegundos: 60, pontosDiariosEngajador: 2 },
      ranking: { limiarTopGeral: 1 },
    });
    await comAmbiente({ arquivoRegras: arquivo }, async (amb) => {
      const ana = await amb.pessoa('ana');
      const bia = await amb.pessoa('bia');
      const p1 = await amb.postar(ana);
      const p2 = await amb.postar(ana);
      await bia.post(`/api/posts/${p1}/comentarios`, { texto: COMENTARIO });
      const barrado = await bia.post(`/api/posts/${p2}/curtida`);
      assert.equal(barrado.status, 429);
      assert.match(barrado.body.erro, /Espere 60 segundos/);
      assert.equal(amb.pontosDe(bia.id).engajador, 2); // o limite diário cortou o comentário de 3 para 2

      const geral = await amb.cliente().get('/api/rankings?periodo=geral&tipo=criador');
      assert.deepEqual(geral.body.pessoas.map((p) => p.usuario), ['ana']);
      assert.equal(geral.body.minimo, 1);
    });
  });

  test('prazo de reset vem do arquivo: semana virando no domingo 20h', async () => {
    // Domingo, 22/11/2026, 19:00 em Brasília (22:00 UTC)
    const { arquivo } = arquivoTemporario({ periodo: { inicioSemanaDia: 0, inicioSemanaHora: 20 } });
    await comAmbiente({ arquivoRegras: arquivo, inicio: Date.UTC(2026, 10, 22, 22, 0) }, async (amb) => {
      const ana = await amb.pessoa('ana');
      const bia = await amb.pessoa('bia');
      const p = await amb.postar(ana);
      await bia.post(`/api/posts/${p}/curtida`);
      assert.equal((await amb.cliente().get('/api/rankings?periodo=semana')).body.pessoas.length, 1);
      amb.relogio.avancar(60 * MIN); // 20:00 de domingo
      assert.equal((await amb.cliente().get('/api/rankings?periodo=semana')).body.pessoas.length, 0);
    });
  });

  test('valor inválido no arquivo é ignorado (vale o padrão)', async () => {
    const { arquivo } = arquivoTemporario({ pontos: { curtir: -5, comentar: 'muito' }, limites: { cooldownSegundos: 0 } });
    await comAmbiente({ arquivoRegras: arquivo }, async (amb) => {
      const r = await amb.cliente().get('/api/regras');
      assert.equal(r.body.pontos.curtir, 1);
      assert.equal(r.body.pontos.comentar, 3);
    });
  });

  test('arquivo quebrado mantém a última versão válida', async () => {
    const { arquivo, escrever } = arquivoTemporario({ pontos: { curtir: 7 } });
    await comAmbiente({ arquivoRegras: arquivo }, async (amb) => {
      assert.equal((await amb.cliente().get('/api/regras')).body.pontos.curtir, 7);
      escrever('{ isto não é json');
      assert.equal((await amb.cliente().get('/api/regras')).body.pontos.curtir, 7);
    });
  });
});

describe('tela de admin (rotas)', () => {
  test('GET /api/regras é público e mostra as regras em vigor', () =>
    comAmbiente({}, async (amb) => {
      const r = await amb.cliente().get('/api/regras');
      assert.equal(r.status, 200);
      assert.equal(r.body.pontos.comentar, 3);
      assert.equal(r.body.ranking.limiarTopGeral, 10);
    }));

  test('quem não administra não vê nem muda as regras', () =>
    comAmbiente({ admins: [ADMIN] }, async (amb) => {
      assert.equal((await amb.cliente().get('/api/admin/regras')).status, 401);
      const ana = await amb.pessoa('ana');
      const r = await ana.get('/api/admin/regras');
      assert.equal(r.status, 403);
      assert.equal(r.body.erro, 'Só quem administra pode ver e mudar as regras.');
      assert.equal((await ana.put('/api/admin/regras', { 'pontos.curtir': 9 })).status, 403);
      assert.equal((await ana.get('/api/auth/eu')).body.admin, false);
    }));

  test('admin vê cada regra com valor, faixa e de onde veio', () =>
    comAmbiente({ admins: [ADMIN] }, async (amb) => {
      const chefe = await amb.pessoa('chefe');
      assert.equal((await chefe.get('/api/auth/eu')).body.admin, true);
      const r = await chefe.get('/api/admin/regras');
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.regras.map((x) => x.chave), CHAVES);
      const limiar = r.body.regras.find((x) => x.chave === 'ranking.limiarTopGeral');
      assert.equal(limiar.valor, 10);
      assert.equal(limiar.origem, 'padrao');
      assert.equal(limiar.rotulo, 'Pontos mínimos para o Top Geral');
    }));

  test('admin muda pontos, limites, cooldown, limiar e reset, e vale na hora', async () => {
    const { arquivo } = arquivoTemporario({ pontos: { curtir: 2 }, limites: { cooldownSegundos: 0 } });
    await comAmbiente({ admins: [ADMIN], arquivoRegras: arquivo }, async (amb) => {
      const chefe = await amb.pessoa('chefe');
      const ana = await amb.pessoa('ana');
      const bia = await amb.pessoa('bia');
      const r = await chefe.put('/api/admin/regras', {
        'pontos.curtir': 5,
        limites: { pontosDiariosEngajador: 100, cooldownSegundos: 30 },
        'ranking.limiarTopGeral': 4,
        'periodo.inicioSemanaDia': 3,
      });
      assert.equal(r.status, 200);
      const curtir = r.body.regras.find((x) => x.chave === 'pontos.curtir');
      assert.deepEqual([curtir.valor, curtir.origem, curtir.arquivo], [5, 'admin', 2]);

      const p1 = await amb.postar(ana);
      const p2 = await amb.postar(ana);
      assert.deepEqual((await bia.post(`/api/posts/${p1}/curtida`)).body.pontos, { engajador: 5, criador: 1 });
      assert.equal((await bia.post(`/api/posts/${p2}/curtida`)).status, 429); // cooldown de 30s
      const geral = await amb.cliente().get('/api/rankings?periodo=geral&tipo=engajador');
      assert.deepEqual(geral.body.pessoas.map((p) => p.usuario), ['bia']);
      assert.equal(geral.body.minimo, 4);

      // null tira a mudança do admin e volta para o arquivo
      const volta = await chefe.put('/api/admin/regras', { 'pontos.curtir': null });
      assert.equal(volta.body.regras.find((x) => x.chave === 'pontos.curtir').valor, 2);
      assert.equal((await amb.cliente().get('/api/regras')).body.pontos.curtir, 2);
    });
  });

  test('admin recebe erro claro para valor inválido e nada é gravado', () =>
    comAmbiente({ admins: [ADMIN] }, async (amb) => {
      const chefe = await amb.pessoa('chefe');
      const r = await chefe.put('/api/admin/regras', {
        'pontos.curtir': 2,
        'pontos.comentar': -1,
        'limites.cooldownSegundos': 1.5,
        'nao.existe': 1,
      });
      assert.equal(r.status, 400);
      assert.deepEqual(r.body.erros, [
        'Comentar um post: use um valor entre 0 e 1000.',
        'Espera entre ações (segundos): use um número inteiro.',
        'Regra desconhecida: nao.existe.',
      ]);
      assert.equal((await amb.cliente().get('/api/regras')).body.pontos.curtir, 1);
    }));

  test('a mudança do admin sobrevive à virada do dia', () =>
    comAmbiente({ admins: [ADMIN] }, async (amb) => {
      const chefe = await amb.pessoa('chefe');
      await chefe.put('/api/admin/regras', { 'pontos.comentar': 7 });
      amb.relogio.avancar(DIA);
      assert.equal((await amb.cliente().get('/api/regras')).body.pontos.comentar, 7);
    }));
});
