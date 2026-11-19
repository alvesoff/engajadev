import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente } from './ajuda.js';

describe('editar o próprio perfil (nome e bio)', () => {
  let amb;
  let ana;
  before(async () => {
    amb = await criarAmbiente();
    ana = await amb.pessoa('ana');
  });
  after(() => amb.fechar());

  test('conta nova começa sem bio', async () => {
    assert.equal((await ana.get('/api/auth/eu')).body.bio, '');
    assert.equal((await amb.cliente().get('/api/usuarios/ana')).body.usuario.bio, '');
  });

  test('salva nome e bio; o perfil público mostra a bio (sem o e-mail)', async () => {
    const r = await ana.put('/api/auth/perfil', { nome: '  Ana Souza  ', bio: '  Dev back-end.\n\nEscrevo   sobre Node e testes.  ' });
    assert.equal(r.status, 200);
    assert.equal(r.body.nome, 'Ana Souza');
    assert.equal(r.body.bio, 'Dev back-end. Escrevo sobre Node e testes.');
    assert.equal((await ana.get('/api/auth/eu')).body.nome, 'Ana Souza');

    const perfil = (await amb.cliente().get('/api/usuarios/ana')).body;
    assert.equal(perfil.usuario.bio, 'Dev back-end. Escrevo sobre Node e testes.');
    assert.equal(perfil.usuario.nome, 'Ana Souza');
    assert.equal(perfil.usuario.email, undefined);
    // o nome novo aparece nos posts e no ranking
    const post = await amb.postar(ana);
    assert.equal((await amb.cliente().get(`/api/posts/${post}`)).body.post.autor.nome, 'Ana Souza');
  });

  test('bio vazia apaga a bio; @usuário e e-mail não mudam por aqui', async () => {
    const r = await ana.put('/api/auth/perfil', { nome: 'Ana', bio: '', usuario: 'outra', email: 'x@exemplo.com' });
    assert.equal(r.status, 200);
    assert.equal(r.body.bio, '');
    assert.equal(r.body.usuario, 'ana');
    assert.equal(r.body.email, 'ana@exemplo.com');
  });

  test('erros com o campo certo; exige login', async () => {
    const casos = [
      [{ nome: '' }, 'nome', 'Informe seu nome.'],
      [{ nome: 'A' }, 'nome', 'O nome deve ter de 2 a 60 caracteres.'],
      [{ nome: 'A'.repeat(61) }, 'nome', 'O nome deve ter de 2 a 60 caracteres.'],
      [{ nome: 'Ana', bio: 'x'.repeat(161) }, 'bio', 'A bio pode ter até 160 caracteres.'],
    ];
    for (const [corpo, campo, mensagem] of casos) {
      const r = await ana.put('/api/auth/perfil', corpo);
      assert.equal(r.status, 400, mensagem);
      assert.equal(r.body.campo, campo);
      assert.equal(r.body.erro, mensagem);
    }
    assert.equal((await ana.put('/api/auth/perfil', { nome: 'Ana', bio: 'x'.repeat(160) })).status, 200);
    assert.equal((await amb.cliente().put('/api/auth/perfil', { nome: 'Invasor' })).status, 401);
  });
});
