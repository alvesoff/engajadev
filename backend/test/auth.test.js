import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { criarAmbiente, ANA, MIN } from './ajuda.js';

describe('cadastro', () => {
  let amb;
  before(async () => (amb = await criarAmbiente()));
  after(() => amb.fechar());

  test('cria a conta, já entra e não devolve a senha', async () => {
    const c = amb.cliente();
    const r = await c.post('/api/auth/cadastro', ANA);
    assert.equal(r.status, 201);
    assert.equal(r.body.nome, 'Ana Souza');
    assert.equal(r.body.usuario, 'ana_dev');
    assert.equal(r.body.email, 'ana@exemplo.com');
    assert.ok(!('senha' in r.body) && !('senha_hash' in r.body));
    assert.ok(!r.texto.includes(ANA.senha));

    const eu = await c.get('/api/auth/eu');
    assert.equal(eu.status, 200);
    assert.equal(eu.body.usuario, 'ana_dev');
  });

  test('cookie de sessão é httpOnly e SameSite=Lax', async () => {
    const r = await amb.cliente().post('/api/auth/cadastro', {
      nome: 'Bia',
      usuario: 'bia',
      email: 'bia@exemplo.com',
      senha: '12345678',
    });
    assert.equal(r.status, 201);
    assert.match(r.setCookie, /^engajadev_sessao=[^;]+;/);
    assert.match(r.setCookie, /HttpOnly/);
    assert.match(r.setCookie, /SameSite=Lax/);
    assert.match(r.setCookie, /Path=\//);
  });

  test('senha fica guardada com hash scrypt, nunca em texto', () => {
    const { senha_hash } = amb.db.prepare('SELECT senha_hash FROM usuarios WHERE email = ?').get(ANA.email);
    assert.ok(!senha_hash.includes(ANA.senha));
    assert.match(senha_hash, /^scrypt\$32768\$8\$3\$/);
  });

  test('token da sessão não fica guardado puro no banco', async () => {
    const c = amb.cliente();
    await c.post('/api/auth/entrar', { email: ANA.email, senha: ANA.senha });
    const token = c.cookie.split('=')[1];
    const linha = amb.db.prepare('SELECT * FROM sessoes WHERE token_hash = ?').get(token);
    assert.equal(linha, undefined);
  });

  test('aceita @ na frente do usuário e e-mail com maiúsculas', async () => {
    const r = await amb.cliente().post('/api/auth/cadastro', {
      nome: '  Caio  ',
      usuario: '@Caio_1',
      email: '  CAIO@Exemplo.com ',
      senha: 'abcdefgh',
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.nome, 'Caio');
    assert.equal(r.body.usuario, 'Caio_1');
    assert.equal(r.body.email, 'caio@exemplo.com');
  });

  test('e-mail repetido (mesmo com outra caixa) dá 409', async () => {
    const r = await amb.cliente().post('/api/auth/cadastro', { ...ANA, usuario: 'outra', email: 'ANA@exemplo.com' });
    assert.equal(r.status, 409);
    assert.equal(r.body.erro, 'Já existe uma conta com este e-mail. Tente entrar.');
    assert.equal(r.body.campo, 'email');
  });

  test('@usuário repetido (mesmo com outra caixa) dá 409', async () => {
    const r = await amb.cliente().post('/api/auth/cadastro', { ...ANA, usuario: '@ANA_DEV', email: 'nova@exemplo.com' });
    assert.equal(r.status, 409);
    assert.equal(r.body.erro, 'Este @usuário já está em uso. Escolha outro.');
    assert.equal(r.body.campo, 'usuario');
  });

  const casos = [
    [{ nome: '' }, 'nome', 'Informe seu nome.'],
    [{ nome: 'A' }, 'nome', 'O nome deve ter de 2 a 60 caracteres.'],
    [{ nome: 'x'.repeat(61) }, 'nome', 'O nome deve ter de 2 a 60 caracteres.'],
    [{ usuario: '' }, 'usuario', 'Escolha um @usuário.'],
    [{ usuario: 'ab' }, 'usuario', 'O @usuário deve ter de 3 a 20 caracteres, só letras sem acento, números ou _.'],
    [{ usuario: 'joão' }, 'usuario', 'O @usuário deve ter de 3 a 20 caracteres, só letras sem acento, números ou _.'],
    [{ usuario: 'com espaco' }, 'usuario', 'O @usuário deve ter de 3 a 20 caracteres, só letras sem acento, números ou _.'],
    [{ email: '' }, 'email', 'Informe seu e-mail.'],
    [{ email: 'sem-arroba' }, 'email', 'Este e-mail não parece válido. Confira se digitou certo.'],
    [{ senha: '' }, 'senha', 'Crie uma senha.'],
    [{ senha: '1234567' }, 'senha', 'A senha precisa ter pelo menos 8 caracteres.'],
    [{ senha: 'x'.repeat(129) }, 'senha', 'A senha pode ter no máximo 128 caracteres.'],
    [{ senha: 12345678 }, 'senha', 'Crie uma senha.'],
  ];
  for (const [troca, campo, mensagem] of casos) {
    test(`valida ${campo}: ${JSON.stringify(troca).slice(0, 40)}`, async () => {
      const corpo = { nome: 'Teste', usuario: 'teste_val', email: 'val@exemplo.com', senha: 'senha12345', ...troca };
      const r = await amb.cliente().post('/api/auth/cadastro', corpo);
      assert.equal(r.status, 400);
      assert.equal(r.body.campo, campo);
      assert.equal(r.body.erro, mensagem);
      assert.equal(r.setCookie, null);
    });
  }

  test('JSON quebrado dá erro em português', async () => {
    const r = await amb.cliente().post('/api/auth/cadastro', undefined, { cru: '{nome:' });
    assert.equal(r.status, 400);
    assert.equal(r.body.erro, 'Os dados enviados não estão em JSON válido.');
  });

  test('rota que não existe dá 404 em português', async () => {
    const r = await amb.cliente().get('/api/nada');
    assert.equal(r.status, 404);
    assert.equal(r.body.erro, 'Rota não encontrada.');
  });
});

describe('entrar, eu e sair', () => {
  let amb;
  before(async () => {
    amb = await criarAmbiente();
    await amb.cliente().post('/api/auth/cadastro', ANA);
  });
  after(() => amb.fechar());

  test('eu sem cookie dá 401', async () => {
    const r = await amb.cliente().get('/api/auth/eu');
    assert.equal(r.status, 401);
    assert.equal(r.body.erro, 'Você não está conectado. Entre para continuar.');
  });

  test('eu com cookie inventado dá 401', async () => {
    const c = amb.cliente();
    c.cookie = 'engajadev_sessao=inventado';
    const r = await c.get('/api/auth/eu');
    assert.equal(r.status, 401);
  });

  test('entra com e-mail e senha certos', async () => {
    const c = amb.cliente();
    const r = await c.post('/api/auth/entrar', { email: ' ANA@exemplo.com ', senha: ANA.senha });
    assert.equal(r.status, 200);
    assert.equal(r.body.nome, ANA.nome);
    assert.match(r.setCookie, /HttpOnly/);
    const eu = await c.get('/api/auth/eu');
    assert.equal(eu.body.email, ANA.email);
  });

  test('senha errada e e-mail que não existe dão a mesma mensagem', async () => {
    const a = await amb.cliente().post('/api/auth/entrar', { email: ANA.email, senha: 'errada123' });
    const b = await amb.cliente().post('/api/auth/entrar', { email: 'ninguem@exemplo.com', senha: 'errada123' });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.erro, 'E-mail ou senha incorretos.');
    assert.deepEqual(a.body, b.body);
    assert.equal(a.setCookie, null);
  });

  test('campos vazios no entrar dão 400 em português', async () => {
    const a = await amb.cliente().post('/api/auth/entrar', { senha: 'x' });
    assert.equal(a.status, 400);
    assert.equal(a.body.erro, 'Informe seu e-mail.');
    const b = await amb.cliente().post('/api/auth/entrar', { email: ANA.email });
    assert.equal(b.status, 400);
    assert.equal(b.body.erro, 'Informe sua senha.');
  });

  test('sair apaga a sessão: o cookie antigo para de valer', async () => {
    const c = amb.cliente();
    await c.post('/api/auth/entrar', { email: ANA.email, senha: ANA.senha });
    const antigo = c.cookie;
    const r = await c.post('/api/auth/sair');
    assert.equal(r.status, 204);
    assert.match(r.setCookie, /Max-Age=0/);

    const outro = amb.cliente();
    outro.cookie = antigo;
    const eu = await outro.get('/api/auth/eu');
    assert.equal(eu.status, 401);
  });

  test('sair sem estar conectado não dá erro', async () => {
    const r = await amb.cliente().post('/api/auth/sair');
    assert.equal(r.status, 204);
  });

  test('sessão vence depois de 30 dias', async () => {
    const c = amb.cliente();
    await c.post('/api/auth/entrar', { email: ANA.email, senha: ANA.senha });
    amb.relogio.avancar(29 * 24 * 60 * MIN);
    assert.equal((await c.get('/api/auth/eu')).status, 200);
    amb.relogio.avancar(2 * 24 * 60 * MIN);
    assert.equal((await c.get('/api/auth/eu')).status, 401);
  });
});

describe('limite de tentativas de login', () => {
  test('bloqueia o e-mail depois de 5 erros, mesmo com a senha certa, e libera depois de 15 minutos', async () => {
    const amb = await criarAmbiente();
    try {
      await amb.cliente().post('/api/auth/cadastro', ANA);
      for (let i = 0; i < 5; i++) {
        const r = await amb.cliente().post('/api/auth/entrar', { email: ANA.email, senha: 'errada' + i });
        assert.equal(r.status, 401);
      }
      const bloqueado = await amb.cliente().post('/api/auth/entrar', { email: ANA.email, senha: ANA.senha });
      assert.equal(bloqueado.status, 429);
      assert.equal(bloqueado.body.erro, 'Muitas tentativas de entrar. Espere 15 minutos e tente de novo.');
      assert.equal(bloqueado.headers.get('retry-after'), '900');
      assert.equal(bloqueado.setCookie, null);

      amb.relogio.avancar(14 * MIN);
      const ainda = await amb.cliente().post('/api/auth/entrar', { email: ANA.email, senha: ANA.senha });
      assert.equal(ainda.status, 429);
      assert.equal(ainda.body.erro, 'Muitas tentativas de entrar. Espere 1 minuto e tente de novo.');

      amb.relogio.avancar(1 * MIN);
      const liberado = await amb.cliente().post('/api/auth/entrar', { email: ANA.email, senha: ANA.senha });
      assert.equal(liberado.status, 200);
    } finally {
      await amb.fechar();
    }
  });

  test('acertar a senha antes do limite zera a contagem do e-mail', async () => {
    const amb = await criarAmbiente();
    try {
      await amb.cliente().post('/api/auth/cadastro', ANA);
      for (let i = 0; i < 4; i++) await amb.cliente().post('/api/auth/entrar', { email: ANA.email, senha: 'errada' });
      assert.equal((await amb.cliente().post('/api/auth/entrar', { email: ANA.email, senha: ANA.senha })).status, 200);
      for (let i = 0; i < 4; i++) await amb.cliente().post('/api/auth/entrar', { email: ANA.email, senha: 'errada' });
      assert.equal((await amb.cliente().post('/api/auth/entrar', { email: ANA.email, senha: ANA.senha })).status, 200);
    } finally {
      await amb.fechar();
    }
  });

  test('bloqueia o IP que tenta muitos e-mails diferentes', async () => {
    const amb = await criarAmbiente({ limites: { porEmail: 5, porIp: 3, janelaMs: 15 * MIN } });
    try {
      for (let i = 0; i < 3; i++) {
        const r = await amb.cliente().post('/api/auth/entrar', { email: `x${i}@exemplo.com`, senha: 'qualquer1' });
        assert.equal(r.status, 401);
      }
      const r = await amb.cliente().post('/api/auth/entrar', { email: 'outro@exemplo.com', senha: 'qualquer1' });
      assert.equal(r.status, 429);
    } finally {
      await amb.fechar();
    }
  });
});
