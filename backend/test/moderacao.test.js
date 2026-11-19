import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarAmbiente } from './ajuda.js';
import { abrirBanco } from '../src/db.js';

const ADMIN = 'chefe@exemplo.com';
const COMENTARIO = 'Comentário caprichado sobre o post, com detalhes.';

/** Bia publica; Ana curte e comenta (pontua como engajadora e a Bia como criadora). */
async function montar() {
  const amb = await criarAmbiente({ admins: [ADMIN] });
  const chefe = await amb.pessoa('chefe');
  const ana = await amb.pessoa('ana');
  const bia = await amb.pessoa('bia');
  const post = await amb.postar(bia, { url: 'https://dev.to/bia/meu-post', titulo: 'Post da Bia' });
  const outro = await amb.postar(bia, { titulo: 'Outro post da Bia' });
  await ana.post(`/api/posts/${post}/curtida`);
  await ana.post(`/api/posts/${post}/comentarios`, { texto: COMENTARIO });
  return { amb, chefe, ana, bia, post, outro };
}

const titulos = async (c, caminho = '/api/posts') => (await c.get(caminho)).body.posts.map((p) => p.titulo);

describe('moderação: remover posts', () => {
  test('o autor apaga o próprio post: some de tudo, os pontos ficam e o link pode voltar', async () => {
    const m = await montar();
    try {
      const antes = { ana: m.amb.pontosDe(m.ana.id), bia: m.amb.pontosDe(m.bia.id) };
      assert.ok(antes.ana.engajador > 0 && antes.bia.criador > 0);

      const r = await m.bia.del(`/api/posts/${m.post}`);
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { removido: true, motivo: 'autor', lancamentosEstornados: 0 });

      assert.deepEqual(await titulos(m.ana), ['Outro post da Bia']);
      const pagina = await m.ana.get(`/api/posts/${m.post}`);
      assert.equal(pagina.status, 404);
      assert.equal(pagina.body.erro, 'Este post foi removido.');
      assert.equal((await m.ana.post(`/api/posts/${m.post}/comentarios`, { texto: COMENTARIO })).status, 404);
      assert.equal((await m.ana.post(`/api/posts/${m.post}/curtida`)).status, 404);

      const perfil = (await m.ana.get('/api/usuarios/bia')).body;
      assert.deepEqual(perfil.posts.map((p) => p.titulo), ['Outro post da Bia']);
      assert.equal(perfil.numeros.posts, 1);
      assert.equal(perfil.numeros.curtidasRecebidas, 0);

      // pontos de todos continuam
      assert.deepEqual(m.amb.pontosDe(m.ana.id), antes.ana);
      assert.deepEqual(m.amb.pontosDe(m.bia.id), antes.bia);

      // o mesmo link pode ser divulgado de novo
      const denovo = await m.bia.post('/api/posts', { url: 'https://dev.to/bia/meu-post', titulo: 'Post da Bia, agora certo' });
      assert.equal(denovo.status, 201);
      assert.equal(denovo.body.post.url, 'https://dev.to/bia/meu-post');

      // apagar de novo: já não existe
      assert.equal((await m.bia.del(`/api/posts/${m.post}`)).status, 404);
    } finally {
      await m.amb.fechar();
    }
  });

  test('o admin remove um post (spam): o autor perde os pontos ganhos com ele, quem engajou não, e o link fica bloqueado', async () => {
    const m = await montar();
    try {
      const ranking = async (tipo) => (await m.ana.get(`/api/rankings?periodo=semana&tipo=${tipo}`)).body.pessoas.map((p) => p.usuario);
      assert.deepEqual(await ranking('criador'), ['bia']);
      const ana = m.amb.pontosDe(m.ana.id);
      // a Bia também ganha com o outro post, que não foi removido
      await m.ana.post(`/api/posts/${m.outro}/curtida`);

      const r = await m.chefe.del(`/api/posts/${m.post}`);
      assert.equal(r.status, 200);
      assert.equal(r.body.motivo, 'moderacao');
      assert.equal(r.body.lancamentosEstornados, 2); // curtida recebida + comentário recebido

      assert.equal(m.amb.pontosDe(m.ana.id).engajador, ana.engajador + 1); // a Ana mantém tudo (+1 da curtida nova)
      assert.equal(m.amb.pontosDe(m.bia.id).criador, 1); // só o do outro post
      assert.deepEqual(await ranking('engajador'), ['ana']);

      const denovo = await m.bia.post('/api/posts', { url: 'https://dev.to/bia/meu-post', titulo: 'Spam de novo' });
      assert.equal(denovo.status, 409);
      assert.equal(denovo.body.erro, 'Este link já foi divulgado no EngajaDev.');
    } finally {
      await m.amb.fechar();
    }
  });

  test('outra pessoa não remove; sem login não remove', async () => {
    const m = await montar();
    try {
      const r = await m.ana.del(`/api/posts/${m.post}`);
      assert.equal(r.status, 403);
      assert.equal(r.body.erro, 'Só quem publicou ou quem administra pode remover este post.');
      assert.equal((await m.amb.cliente().del(`/api/posts/${m.post}`)).status, 401);
      assert.equal((await m.ana.get(`/api/posts/${m.post}`)).status, 200);
    } finally {
      await m.amb.fechar();
    }
  });

  test('post removido sai dos destaques e não pode ser destacado', async () => {
    const amb = await criarAmbiente({ admins: [ADMIN], regras: { limites: { comentariosPontuadosPorPost: 0 } } });
    try {
      const chefe = await amb.pessoa('chefe');
      const ana = await amb.pessoa('ana');
      const bia = await amb.pessoa('bia');
      const postBia = await amb.postar(bia);
      for (let i = 0; i < 4; i++) await ana.post(`/api/posts/${postBia}/comentarios`, { texto: COMENTARIO });
      const destaque = (await chefe.post('/api/admin/premios', { nome: 'Destaque', custo: 3, tipo: 'destaque', diasDestaque: 2 })).body;
      const postAna = await amb.postar(ana, { titulo: 'Post da Ana' });
      const outroAna = await amb.postar(ana, { titulo: 'Outro da Ana' });

      assert.equal((await ana.post(`/api/premios/${destaque.id}/resgatar`, { postId: postAna })).status, 201);
      assert.equal((await ana.get('/api/posts')).body.destaques.length, 1);
      await ana.del(`/api/posts/${postAna}`);
      assert.deepEqual((await ana.get('/api/posts')).body.destaques, []);

      await ana.del(`/api/posts/${outroAna}`);
      const r = await ana.post(`/api/premios/${destaque.id}/resgatar`, { postId: outroAna });
      assert.equal(r.status, 400);
      assert.equal(r.body.erro, 'Você só pode destacar um post seu.');
    } finally {
      await amb.fechar();
    }
  });
});

describe('banco antigo ganha as colunas da moderação', () => {
  test('abrir um banco criado antes da moderação não perde os posts', () => {
    const pasta = mkdtempSync(join(tmpdir(), 'engajadev-'));
    const arquivo = join(pasta, 'antigo.db');
    try {
      const velho = new DatabaseSync(arquivo);
      velho.exec(`CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nome TEXT, usuario TEXT, email TEXT, senha_hash TEXT, criado_em INTEGER);
        CREATE TABLE posts (id INTEGER PRIMARY KEY, usuario_id INTEGER NOT NULL, url TEXT NOT NULL UNIQUE, titulo TEXT NOT NULL,
          descricao TEXT NOT NULL DEFAULT '', rede TEXT NOT NULL, criado_em INTEGER NOT NULL);
        INSERT INTO usuarios VALUES (1, 'Ana', 'ana', 'ana@exemplo.com', 'x', 0);
        INSERT INTO posts (usuario_id, url, titulo, rede, criado_em) VALUES (1, 'https://dev.to/a/b', 'Antigo', 'devto', 0);`);
      velho.close();

      const db = abrirBanco(arquivo);
      const colunas = db.prepare('PRAGMA table_info(posts)').all().map((c) => c.name);
      assert.ok(['removido_em', 'removido_por', 'removido_motivo'].every((c) => colunas.includes(c)));
      assert.equal(db.prepare('SELECT titulo FROM posts').get().titulo, 'Antigo');
      db.close();
      abrirBanco(arquivo).close(); // abrir de novo não tenta criar as colunas outra vez
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });
});
