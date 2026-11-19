import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { erro } from '../erros.js';
import { conferirSenha, conferirSenhaFalsa, gerarHash } from '../senha.js';
import { criarLimitador } from '../limite.js';

export const COOKIE = 'engajadev_sessao';
const SESSAO_DIAS = 30;
const MIN = 60_000;

const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const texto = (v) => (typeof v === 'string' ? v.trim() : '');

function lerCookie(req, nome) {
  const cab = req.headers.cookie ?? '';
  for (const parte of cab.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) {
      try {
        return decodeURIComponent(v.join('='));
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** O que pode sair do servidor sobre um usuário. Nunca inclui a senha. */
export const usuarioPublico = (u) => ({
  id: u.id,
  nome: u.nome,
  usuario: u.usuario,
  email: u.email,
  criadoEm: u.criado_em,
});

/** Middleware: coloca req.usuario quando o cookie aponta para uma sessão válida. */
export function carregarSessao(ctx) {
  return (req, _res, next) => {
    req.usuario = null;
    const token = lerCookie(req, COOKIE);
    if (token) {
      const u = ctx.db
        .prepare(
          `SELECT u.* FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
           WHERE s.token_hash = ? AND s.expira_em > ?`,
        )
        .get(hashToken(token), ctx.agora());
      if (u) req.usuario = u;
    }
    next();
  };
}

export function exigirLogin(req, _res, next) {
  if (!req.usuario) return next(erro(401, 'Você não está conectado. Entre para continuar.'));
  next();
}

function cookie(valor, maxAge) {
  const seguro = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE}=${valor}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${seguro}`;
}

function criarSessao(ctx, res, usuarioId) {
  const token = randomBytes(32).toString('base64url');
  const maxAge = SESSAO_DIAS * 86400;
  const agora = ctx.agora();
  ctx.db
    .prepare('INSERT INTO sessoes (token_hash, usuario_id, criado_em, expira_em) VALUES (?, ?, ?, ?)')
    .run(hashToken(token), usuarioId, agora, agora + maxAge * 1000);
  ctx.db.prepare('DELETE FROM sessoes WHERE expira_em <= ?').run(agora);
  res.setHeader('Set-Cookie', cookie(token, maxAge));
}

/** Confere os campos do cadastro. Lança erro 400 com o campo e a mensagem. */
function validarCadastro(corpo) {
  const nome = texto(corpo?.nome);
  const usuario = texto(corpo?.usuario).replace(/^@/, '');
  const email = texto(corpo?.email).toLowerCase();
  const senha = typeof corpo?.senha === 'string' ? corpo.senha : '';

  if (!nome) throw erro(400, 'Informe seu nome.', { campo: 'nome' });
  if (nome.length < 2 || nome.length > 60) throw erro(400, 'O nome deve ter de 2 a 60 caracteres.', { campo: 'nome' });
  if (!usuario) throw erro(400, 'Escolha um @usuário.', { campo: 'usuario' });
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(usuario)) {
    throw erro(400, 'O @usuário deve ter de 3 a 20 caracteres, só letras sem acento, números ou _.', { campo: 'usuario' });
  }
  if (!email) throw erro(400, 'Informe seu e-mail.', { campo: 'email' });
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw erro(400, 'Este e-mail não parece válido. Confira se digitou certo.', { campo: 'email' });
  }
  if (!senha) throw erro(400, 'Crie uma senha.', { campo: 'senha' });
  if (senha.length < 8) throw erro(400, 'A senha precisa ter pelo menos 8 caracteres.', { campo: 'senha' });
  if (senha.length > 128) throw erro(400, 'A senha pode ter no máximo 128 caracteres.', { campo: 'senha' });

  return { nome, usuario, email, senha };
}

/**
 * Rotas de conta: cadastro, entrar, sair e "quem sou eu".
 * @param {object} ctx { db, agora }
 * @param {object} limites { porEmail, porIp, janelaMs }
 */
export function rotasAuth(ctx, { porEmail = 5, porIp = 50, janelaMs = 15 * MIN } = {}) {
  const r = Router();
  // O que a própria pessoa vê sobre si: os dados públicos, o e-mail e se ela administra.
  const eu = (u) => ({ ...usuarioPublico(u), admin: Boolean(ctx.ehAdmin?.(u)) });
  const limiteEmail = criarLimitador({ maximo: porEmail, janelaMs, agora: ctx.agora });
  const limiteIp = criarLimitador({ maximo: porIp, janelaMs, agora: ctx.agora });

  // Contas criadas por IP na última hora (anti-gaming: contas falsas em série).
  // A vaga é reservada antes de calcular o hash (que é demorado), para pedidos simultâneos
  // não passarem do limite; se o cadastro falhar, a vaga volta.
  const cadastrosPorIp = new Map(); // ip -> [instantes]
  function reservarCadastro(ip) {
    const maximo = ctx.regras().limites.cadastrosPorIpHora;
    const desde = ctx.agora() - 60 * MIN;
    const recentes = (cadastrosPorIp.get(ip) ?? []).filter((t) => t > desde);
    if (recentes.length) cadastrosPorIp.set(ip, recentes);
    else cadastrosPorIp.delete(ip);
    if (maximo > 0 && recentes.length >= maximo) {
      const espera = Math.max(1, Math.ceil((recentes[0] + 60 * MIN - ctx.agora()) / 1000));
      const minutos = Math.ceil(espera / 60);
      const e = erro(429, `Muitas contas criadas a partir desta rede. Espere ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} e tente de novo.`, {
        esperarSegundos: espera,
      });
      e.retryAfter = espera;
      throw e;
    }
    const instante = ctx.agora();
    cadastrosPorIp.set(ip, [...recentes, instante]);
    return () => {
      const lista = cadastrosPorIp.get(ip) ?? [];
      const i = lista.indexOf(instante);
      if (i >= 0) lista.splice(i, 1);
      if (!lista.length) cadastrosPorIp.delete(ip);
    };
  }

  r.post('/cadastro', async (req, res) => {
    const { nome, usuario, email, senha } = validarCadastro(req.body);
    let devolver;
    try {
      devolver = reservarCadastro(req.ip);
    } catch (e) {
      res.setHeader('Retry-After', String(e.retryAfter));
      throw e;
    }
    let id;
    try {
      const existe = ctx.db.prepare('SELECT usuario, email FROM usuarios WHERE usuario = ? OR email = ?').get(usuario, email);
      if (existe) {
        if (existe.email.toLowerCase() === email) throw erro(409, 'Já existe uma conta com este e-mail. Tente entrar.', { campo: 'email' });
        throw erro(409, 'Este @usuário já está em uso. Escolha outro.', { campo: 'usuario' });
      }
      const senhaHash = await gerarHash(senha);
      id = Number(
        ctx.db
          .prepare('INSERT INTO usuarios (nome, usuario, email, senha_hash, criado_em) VALUES (?, ?, ?, ?, ?)')
          .run(nome, usuario, email, senhaHash, ctx.agora()).lastInsertRowid,
      );
    } catch (e) {
      devolver();
      throw e;
    }
    criarSessao(ctx, res, id);
    const u = ctx.db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
    res.status(201).json(eu(u));
  });

  r.post('/entrar', async (req, res) => {
    const email = texto(req.body?.email).toLowerCase();
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
    if (!email) throw erro(400, 'Informe seu e-mail.', { campo: 'email' });
    if (!senha) throw erro(400, 'Informe sua senha.', { campo: 'senha' });

    const chaveEmail = `email:${email}`;
    const chaveIp = `ip:${req.ip}`;
    const espera = Math.max(limiteEmail.bloqueadoPor(chaveEmail), limiteIp.bloqueadoPor(chaveIp));
    if (espera > 0) {
      res.setHeader('Retry-After', String(espera));
      const minutos = Math.ceil(espera / 60);
      throw erro(429, `Muitas tentativas de entrar. Espere ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} e tente de novo.`, {
        esperarSegundos: espera,
      });
    }

    const u = ctx.db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    const ok = u && senha.length <= 128 ? await conferirSenha(senha, u.senha_hash) : await conferirSenhaFalsa(senha.slice(0, 128));
    if (!ok) {
      limiteEmail.falhou(chaveEmail);
      limiteIp.falhou(chaveIp);
      throw erro(401, 'E-mail ou senha incorretos.');
    }
    limiteEmail.limpar(chaveEmail);
    criarSessao(ctx, res, u.id);
    res.json(eu(u));
  });

  r.post('/sair', (req, res) => {
    const token = lerCookie(req, COOKIE);
    if (token) ctx.db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(hashToken(token));
    res.setHeader('Set-Cookie', cookie('', 0));
    res.status(204).end();
  });

  r.get('/eu', exigirLogin, (req, res) => res.json(eu(req.usuario)));

  return r;
}
