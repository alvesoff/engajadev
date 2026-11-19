import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente, MIN } from './ajuda.js';

const SENHA = 'senha-forte-123';
const NOVA = 'outra-senha-forte-456';

/** Ana conectada em três aparelhos (o celular é o que ela está usando). */
async function montar(opcoes) {
  const amb = await criarAmbiente(opcoes);
  const celular = await amb.pessoa('ana');
  const notebook = amb.cliente();
  const emprestado = amb.cliente();
  for (const c of [notebook, emprestado]) {
    assert.equal((await c.post('/api/auth/entrar', { email: 'ana@exemplo.com', senha: SENHA })).status, 200);
  }
  return { amb, celular, notebook, emprestado };
}

describe('segurança da conta', () => {
  test('mostra quantos outros aparelhos estão conectados', async () => {
    const m = await montar();
    try {
      assert.deepEqual((await m.celular.get('/api/auth/sessoes')).body, { outras: 2 });
      assert.equal((await m.amb.cliente().get('/api/auth/sessoes')).status, 401);
    } finally {
      await m.amb.fechar();
    }
  });

  test('sair dos outros aparelhos: só este continua conectado', async () => {
    const m = await montar();
    try {
      const r = await m.celular.post('/api/auth/sair-dos-outros');
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { encerradas: 2 });
      assert.equal((await m.celular.get('/api/auth/eu')).status, 200);
      assert.equal((await m.notebook.get('/api/auth/eu')).status, 401);
      assert.equal((await m.emprestado.get('/api/auth/eu')).status, 401);
      assert.deepEqual((await m.celular.get('/api/auth/sessoes')).body, { outras: 0 });
    } finally {
      await m.amb.fechar();
    }
  });

  test('trocar a senha: pede a atual, desconecta os outros aparelhos e a senha antiga para de valer', async () => {
    const m = await montar();
    try {
      const r = await m.celular.put('/api/auth/senha', { senhaAtual: SENHA, senhaNova: NOVA });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { ok: true, outrasSessoesEncerradas: 2 });
      assert.equal((await m.celular.get('/api/auth/eu')).status, 200);
      assert.equal((await m.notebook.get('/api/auth/eu')).status, 401);

      const velha = await m.amb.cliente().post('/api/auth/entrar', { email: 'ana@exemplo.com', senha: SENHA });
      assert.equal(velha.status, 401);
      const nova = await m.amb.cliente().post('/api/auth/entrar', { email: 'ana@exemplo.com', senha: NOVA });
      assert.equal(nova.status, 200);
      // a senha nunca volta na resposta
      assert.ok(!JSON.stringify(r.body).includes(NOVA));
    } finally {
      await m.amb.fechar();
    }
  });

  test('erros da troca de senha, com o campo certo', async () => {
    const m = await montar();
    try {
      const casos = [
        [{ senhaNova: NOVA }, 'senhaAtual', 'Informe sua senha atual.'],
        [{ senhaAtual: SENHA, senhaNova: 'curta' }, 'senhaNova', 'A senha precisa ter pelo menos 8 caracteres.'],
        [{ senhaAtual: SENHA, senhaNova: 'x'.repeat(129) }, 'senhaNova', 'A senha pode ter no máximo 128 caracteres.'],
        [{ senhaAtual: 'errada-123', senhaNova: NOVA }, 'senhaAtual', 'A senha atual está errada.'],
        [{ senhaAtual: SENHA, senhaNova: SENHA }, 'senhaNova', 'A nova senha precisa ser diferente da atual.'],
      ];
      for (const [corpo, campo, mensagem] of casos) {
        const r = await m.celular.put('/api/auth/senha', corpo);
        assert.equal(r.status, 400, mensagem);
        assert.equal(r.body.campo, campo);
        assert.equal(r.body.erro, mensagem);
      }
      // nada mudou: os outros aparelhos continuam e a senha antiga vale
      assert.equal((await m.notebook.get('/api/auth/eu')).status, 200);
      assert.equal((await m.amb.cliente().put('/api/auth/senha', { senhaAtual: SENHA, senhaNova: NOVA })).status, 401);
    } finally {
      await m.amb.fechar();
    }
  });

  test('errar a senha atual 5 vezes bloqueia a troca por 15 minutos', async () => {
    const m = await montar();
    try {
      for (let i = 0; i < 5; i++) {
        assert.equal((await m.celular.put('/api/auth/senha', { senhaAtual: `errada-${i}-xx`, senhaNova: NOVA })).status, 400);
      }
      const bloqueado = await m.celular.put('/api/auth/senha', { senhaAtual: SENHA, senhaNova: NOVA });
      assert.equal(bloqueado.status, 429);
      assert.equal(bloqueado.body.erro, 'Muitas tentativas com a senha errada. Espere 15 minutos e tente de novo.');
      assert.ok(Number(bloqueado.headers.get('retry-after')) > 0);
      m.amb.relogio.avancar(15 * MIN);
      assert.equal((await m.celular.put('/api/auth/senha', { senhaAtual: SENHA, senhaNova: NOVA })).status, 200);
    } finally {
      await m.amb.fechar();
    }
  });
});
