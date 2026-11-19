import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente } from './ajuda.js';
import { analisarLink } from '../src/redes.js';

describe('rede do link', () => {
  const casos = [
    ['https://www.linkedin.com/posts/ana_123', 'linkedin'],
    ['https://lnkd.in/abc', 'linkedin'],
    ['https://www.instagram.com/p/xyz/', 'instagram'],
    ['https://dev.to/ana/meu-post', 'devto'],
    ['https://x.com/ana/status/1', 'x'],
    ['https://twitter.com/ana/status/1', 'x'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://www.youtube.com/watch?v=abc', 'youtube'],
    ['https://medium.com/@ana/post', 'medium'],
    ['https://github.com/ana/repo', 'github'],
    ['https://www.tabnews.com.br/ana/post', 'tabnews'],
    ['https://blog.ana.dev/post', 'outra'],
    ['https://notlinkedin.com/x', 'outra'],
  ];
  for (const [url, rede] of casos) {
    test(`${url} → ${rede}`, () => assert.equal(analisarLink(url).rede, rede));
  }
  test('recusa o que não é link http(s)', () => {
    for (const ruim of ['', 'linkedin', 'javascript:alert(1)', 'ftp://x.com/a', 'https://localhost/x', 'https://a:b@x.com']) {
      assert.equal(analisarLink(ruim), null, ruim);
    }
  });
  test('tira o #trecho do final', () => {
    assert.equal(analisarLink('https://dev.to/a/b#comentarios').url, 'https://dev.to/a/b');
  });
});

describe('postar e feed', () => {
  let amb, ana, bia;
  before(async () => {
    amb = await criarAmbiente();
    ana = await amb.pessoa('ana');
    bia = await amb.pessoa('bia');
  });
  after(() => amb.fechar());

  test('postar exige login', async () => {
    const r = await amb.cliente().post('/api/posts', { url: 'https://dev.to/x/y', titulo: 'Oi pessoal' });
    assert.equal(r.status, 401);
  });

  test('posta o link e a rede é detectada', async () => {
    const r = await ana.post('/api/posts', {
      url: 'https://www.linkedin.com/posts/ana_react-hooks',
      titulo: '  Hooks do React sem mistério  ',
      descricao: 'Um resumo prático.',
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.post.rede, 'linkedin');
    assert.equal(r.body.post.titulo, 'Hooks do React sem mistério');
    assert.equal(r.body.post.autor.usuario, 'ana');
    assert.equal(r.body.post.curtidas, 0);
  });

  test('valida o post com mensagens em português', async () => {
    const casos = [
      [{ titulo: 'Título ok' }, 'url', 'Cole o link do seu post.'],
      [{ url: 'nao-e-link', titulo: 'Título ok' }, 'url', 'Este link não parece válido. Ele precisa começar com http:// ou https://.'],
      [{ url: 'https://dev.to/a/1', titulo: 'ab' }, 'titulo', 'O título deve ter de 3 a 120 caracteres.'],
      [{ url: 'https://dev.to/a/1', titulo: 'Ok ok', descricao: 'x'.repeat(501) }, 'descricao', 'A descrição pode ter até 500 caracteres.'],
    ];
    for (const [corpo, campo, mensagem] of casos) {
      const r = await ana.post('/api/posts', corpo);
      assert.equal(r.status, 400);
      assert.equal(r.body.campo, campo);
      assert.equal(r.body.erro, mensagem);
    }
  });

  test('o mesmo link não entra duas vezes', async () => {
    const r = await bia.post('/api/posts', { url: 'https://www.linkedin.com/posts/ana_react-hooks#x', titulo: 'Repetido' });
    assert.equal(r.status, 409);
    assert.equal(r.body.erro, 'Este link já foi divulgado no EngajaDev.');
  });

  test('feed é público, do mais novo para o mais antigo, com filtro por rede e páginas', async () => {
    await bia.post('/api/posts', { url: 'https://youtu.be/video1', titulo: 'Vídeo sobre Node' });
    await bia.post('/api/posts', { url: 'https://dev.to/bia/sqlite', titulo: 'SQLite no Node' });
    const todos = await amb.cliente().get('/api/posts');
    assert.equal(todos.status, 200);
    assert.deepEqual(
      todos.body.posts.map((p) => p.titulo),
      ['SQLite no Node', 'Vídeo sobre Node', 'Hooks do React sem mistério'],
    );
    const yt = await amb.cliente().get('/api/posts?rede=youtube');
    assert.deepEqual(yt.body.posts.map((p) => p.rede), ['youtube']);
    const pag1 = await amb.cliente().get('/api/posts?limite=2');
    assert.equal(pag1.body.posts.length, 2);
    const pag2 = await amb.cliente().get(`/api/posts?limite=2&antes=${pag1.body.proximo}`);
    assert.deepEqual(pag2.body.posts.map((p) => p.titulo), ['Hooks do React sem mistério']);
  });

  test('post que não existe dá 404', async () => {
    const r = await amb.cliente().get('/api/posts/9999');
    assert.equal(r.status, 404);
    assert.equal(r.body.erro, 'Post não encontrado.');
  });
});

describe('curtir, comentar e pontos', () => {
  let amb, ana, bia, postAna;
  before(async () => {
    amb = await criarAmbiente();
    ana = await amb.pessoa('ana');
    bia = await amb.pessoa('bia');
    postAna = await amb.postar(ana);
  });
  after(() => amb.fechar());

  test('curtir exige login', async () => {
    assert.equal((await amb.cliente().post(`/api/posts/${postAna}/curtida`)).status, 401);
  });

  test('curtir dá 1 ponto para quem curtiu e 1 para o autor', async () => {
    const r = await bia.post(`/api/posts/${postAna}/curtida`);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.pontos, { engajador: 1, criador: 1 });
    assert.equal(r.body.post.curtidas, 1);
    assert.equal(r.body.post.curtiu, true);
    assert.deepEqual(amb.pontosDe(bia.id), { engajador: 1, criador: 0 });
    assert.deepEqual(amb.pontosDe(ana.id), { engajador: 0, criador: 1 });
  });

  test('curtir duas vezes não soma de novo', async () => {
    const r = await bia.post(`/api/posts/${postAna}/curtida`);
    assert.deepEqual(r.body.pontos, { engajador: 0, criador: 0, motivo: 'ja_curtiu' });
    assert.equal(r.body.post.curtidas, 1);
    assert.deepEqual(amb.pontosDe(bia.id), { engajador: 1, criador: 0 });
  });

  test('descurtir devolve os pontos; curtir de novo não pontua mais', async () => {
    const d = await bia.del(`/api/posts/${postAna}/curtida`);
    assert.equal(d.status, 200);
    assert.equal(d.body.post.curtidas, 0);
    assert.deepEqual(amb.pontosDe(bia.id), { engajador: 0, criador: 0 });
    assert.deepEqual(amb.pontosDe(ana.id), { engajador: 0, criador: 0 });

    const c = await bia.post(`/api/posts/${postAna}/curtida`);
    assert.deepEqual(c.body.pontos, { engajador: 0, criador: 0, motivo: 'ja_pontuou' });
    assert.equal(c.body.post.curtidas, 1);
    assert.deepEqual(amb.pontosDe(bia.id), { engajador: 0, criador: 0 });
  });

  test('comentar dá 3 pontos para quem comentou e 2 para o autor', async () => {
    const r = await bia.post(`/api/posts/${postAna}/comentarios`, { texto: 'Muito bom, aprendi bastante com esse post!' });
    assert.equal(r.status, 201);
    assert.deepEqual(r.body.pontos, { engajador: 3, criador: 2 });
    assert.equal(r.body.comentario.autor.usuario, 'bia');
    assert.deepEqual(amb.pontosDe(bia.id), { engajador: 3, criador: 0 });
    assert.deepEqual(amb.pontosDe(ana.id), { engajador: 0, criador: 2 });
  });

  test('comentário vazio ou grande demais dá erro em português', async () => {
    const a = await bia.post(`/api/posts/${postAna}/comentarios`, { texto: '   ' });
    assert.equal(a.status, 400);
    assert.equal(a.body.erro, 'Escreva um comentário.');
    const b = await bia.post(`/api/posts/${postAna}/comentarios`, { texto: 'x'.repeat(1001) });
    assert.equal(b.status, 400);
    assert.equal(b.body.erro, 'O comentário pode ter até 1000 caracteres.');
  });

  test('o post mostra os comentários e as contagens', async () => {
    const r = await ana.get(`/api/posts/${postAna}`);
    assert.equal(r.status, 200);
    assert.equal(r.body.post.comentarios, 1);
    assert.equal(r.body.post.curtidas, 1);
    assert.equal(r.body.post.curtiu, false);
    assert.equal(r.body.comentarios[0].texto, 'Muito bom, aprendi bastante com esse post!');
  });

  test('cada ponto vira uma linha no livro-razão', () => {
    const linhas = amb.db.prepare('SELECT tipo, papel, pontos FROM lancamentos ORDER BY id').all();
    assert.deepEqual(
      linhas.map((l) => `${l.tipo}:${l.papel}:${l.pontos}`),
      ['comentar:engajador:3', 'comentario_recebido:criador:2'],
    );
  });
});
