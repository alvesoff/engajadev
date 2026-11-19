import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente, DIA } from './ajuda.js';

const ADMIN = 'chefe@exemplo.com';

async function montar(regras) {
  const amb = await criarAmbiente({ admins: [ADMIN], regras });
  const chefe = await amb.pessoa('chefe');
  const ana = await amb.pessoa('ana');
  const bia = await amb.pessoa('bia');
  const caio = await amb.pessoa('caio');
  const spam = await amb.postar(bia, { titulo: 'Compre seguidores' });
  const bom = await amb.postar(bia, { titulo: 'Post bom' });
  return { amb, chefe, ana, bia, caio, spam, bom };
}

describe('denúncias de posts', () => {
  test('a comunidade denuncia e o admin vê a fila, com o post mais denunciado primeiro', async () => {
    const m = await montar();
    try {
      assert.equal((await m.ana.post(`/api/posts/${m.spam}/denuncias`, { motivo: 'spam' })).status, 201);
      assert.equal((await m.caio.post(`/api/posts/${m.spam}/denuncias`, { motivo: 'fora_do_tema', detalhe: 'Venda de seguidores' })).status, 201);
      assert.equal((await m.ana.post(`/api/posts/${m.bom}/denuncias`, { motivo: 'link_quebrado' })).status, 201);

      const r = await m.chefe.get('/api/admin/denuncias');
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.fila.map((g) => [g.post.titulo, g.total]), [['Compre seguidores', 2], ['Post bom', 1]]);
      const g = r.body.fila[0];
      assert.deepEqual(g.motivos, { spam: 1, fora_do_tema: 1 });
      assert.equal(g.post.autor.usuario, 'bia');
      assert.deepEqual(g.denuncias.map((d) => d.quem.usuario), ['ana', 'caio']);
      assert.equal(g.denuncias[1].detalhe, 'Venda de seguidores');
      assert.equal(r.body.motivos.spam, 'Spam ou propaganda');
    } finally {
      await m.amb.fechar();
    }
  });

  test('regras: motivo válido, "outro" pede detalhe, não denuncia o próprio post, uma vez só, exige login', async () => {
    const m = await montar();
    try {
      const sem = await m.ana.post(`/api/posts/${m.spam}/denuncias`, {});
      assert.equal(sem.status, 400);
      assert.equal(sem.body.erro, 'Escolha o motivo da denúncia.');
      assert.equal((await m.ana.post(`/api/posts/${m.spam}/denuncias`, { motivo: 'toString' })).status, 400);
      const outro = await m.ana.post(`/api/posts/${m.spam}/denuncias`, { motivo: 'outro' });
      assert.equal(outro.status, 400);
      assert.equal(outro.body.campo, 'detalhe');
      assert.equal((await m.ana.post(`/api/posts/${m.spam}/denuncias`, { motivo: 'spam', detalhe: 'x'.repeat(301) })).status, 400);

      const proprio = await m.bia.post(`/api/posts/${m.spam}/denuncias`, { motivo: 'spam' });
      assert.equal(proprio.status, 400);
      assert.equal(proprio.body.erro, 'Você não pode denunciar o seu próprio post.');

      assert.equal((await m.ana.post(`/api/posts/${m.spam}/denuncias`, { motivo: 'outro', detalhe: 'Golpe' })).status, 201);
      const repetida = await m.ana.post(`/api/posts/${m.spam}/denuncias`, { motivo: 'spam' });
      assert.equal(repetida.status, 409);
      assert.equal(repetida.body.erro, 'Você já denunciou este post. A moderação vai analisar.');

      assert.equal((await m.amb.cliente().post(`/api/posts/${m.spam}/denuncias`, { motivo: 'spam' })).status, 401);
      assert.equal((await m.ana.post('/api/posts/9999/denuncias', { motivo: 'spam' })).status, 404);
    } finally {
      await m.amb.fechar();
    }
  });

  test('só o admin vê a fila', async () => {
    const m = await montar();
    try {
      const r = await m.ana.get('/api/admin/denuncias');
      assert.equal(r.status, 403);
      assert.equal((await m.ana.post(`/api/admin/denuncias/${m.spam}/manter`)).status, 403);
      assert.equal((await m.amb.cliente().get('/api/admin/denuncias')).status, 401);
    } finally {
      await m.amb.fechar();
    }
  });

  test('manter fecha as denúncias e o post continua; remover fecha como "removido" e tira da fila', async () => {
    const m = await montar();
    try {
      await m.ana.post(`/api/posts/${m.spam}/denuncias`, { motivo: 'spam' });
      await m.caio.post(`/api/posts/${m.spam}/denuncias`, { motivo: 'spam' });
      await m.ana.post(`/api/posts/${m.bom}/denuncias`, { motivo: 'link_quebrado' });

      const manter = await m.chefe.post(`/api/admin/denuncias/${m.bom}/manter`);
      assert.equal(manter.status, 200);
      assert.equal(manter.body.fechadas, 1);
      assert.equal((await m.chefe.post(`/api/admin/denuncias/${m.bom}/manter`)).status, 404);
      assert.equal((await m.ana.get(`/api/posts/${m.bom}`)).status, 200);

      assert.equal((await m.chefe.del(`/api/posts/${m.spam}`)).status, 200);
      assert.deepEqual((await m.chefe.get('/api/admin/denuncias')).body.fila, []);
      const linhas = m.amb.db.prepare('SELECT post_id, resultado FROM denuncias ORDER BY id').all();
      assert.deepEqual(
        linhas.map((l) => [l.post_id, l.resultado]),
        [[m.spam, 'removido'], [m.spam, 'removido'], [m.bom, 'mantido']],
      );
      // post removido não recebe mais denúncia
      assert.equal((await m.amb.pessoa('duda').then((d) => d.post(`/api/posts/${m.spam}/denuncias`, { motivo: 'spam' }))).status, 404);
    } finally {
      await m.amb.fechar();
    }
  });

  test('limite de denúncias por dia (configurável); vira o dia e libera', async () => {
    const m = await montar({ limites: { denunciasPorDia: 2 } });
    try {
      const posts = [m.spam, m.bom, await m.amb.postar(m.bia, { titulo: 'Terceiro' })];
      assert.equal((await m.ana.post(`/api/posts/${posts[0]}/denuncias`, { motivo: 'spam' })).status, 201);
      assert.equal((await m.ana.post(`/api/posts/${posts[1]}/denuncias`, { motivo: 'spam' })).status, 201);
      const r = await m.ana.post(`/api/posts/${posts[2]}/denuncias`, { motivo: 'spam' });
      assert.equal(r.status, 429);
      assert.equal(r.body.erro, 'Você já fez 2 denúncias hoje. Tente de novo amanhã.');
      m.amb.relogio.avancar(DIA);
      assert.equal((await m.ana.post(`/api/posts/${posts[2]}/denuncias`, { motivo: 'spam' })).status, 201);
    } finally {
      await m.amb.fechar();
    }
  });
});
