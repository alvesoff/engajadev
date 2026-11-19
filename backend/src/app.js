import express from 'express';
import { ErroHttp } from './erros.js';
import { criarLeitorRegras } from './regras.js';
import { carregarSessao, rotasAuth } from './rotas/auth.js';
import { rotasPosts } from './rotas/posts.js';
import { rotasRankings } from './rotas/rankings.js';
import { rotasCarteira } from './rotas/carteira.js';
import { rotasUsuarios } from './rotas/usuarios.js';
import { rotasRegras } from './rotas/regras.js';
import { conferirCooldown, conferirLimitePosts } from './pontos.js';

/**
 * Monta a aplicação.
 * @param {object} opcoes
 * @param {import('node:sqlite').DatabaseSync} opcoes.db
 * @param {() => number} [opcoes.agora] relógio em ms (dá para trocar nos testes)
 * @param {object} [opcoes.limites] limite de tentativas de login { porEmail, porIp, janelaMs }
 * @param {boolean|string|number} [opcoes.trustProxy] valor do "trust proxy" do Express
 * @param {object} [opcoes.regras] regras que valem por cima do padrão (usado nos testes)
 * @param {string} [opcoes.arquivoRegras] caminho do config/regras.json
 * @param {string[]} [opcoes.admins] e-mails de quem administra (pode mudar as regras)
 */
export function criarApp({ db, agora = () => Date.now(), limites, trustProxy = false, regras, arquivoRegras, admins = [] } = {}) {
  const listaAdmins = admins.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  const ctx = { db, agora, regras: criarLeitorRegras({ arquivo: arquivoRegras, db, extra: regras }) };
  ctx.ehAdmin = (u) => Boolean(u && listaAdmins.includes(String(u.email).toLowerCase()));
  ctx.antesDeEngajar = (usuario) => conferirCooldown(ctx, usuario.id);
  ctx.antesDePostar = (usuario) => conferirLimitePosts(ctx, usuario.id);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use(express.json({ limit: '10kb' }));
  app.use(carregarSessao(ctx));

  app.use('/api/auth', rotasAuth(ctx, limites));
  app.use('/api/posts', rotasPosts(ctx));
  app.use('/api/rankings', rotasRankings(ctx));
  app.use('/api/carteira', rotasCarteira(ctx));
  app.use('/api/usuarios', rotasUsuarios(ctx));
  app.use('/api', rotasRegras(ctx));
  app.use('/api', (_req, _res, next) => next(new ErroHttp(404, 'Rota não encontrada.')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof ErroHttp) return res.status(err.status).json({ erro: err.message, ...err.extra });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ erro: 'Os dados enviados não estão em JSON válido.' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ erro: 'Os dados enviados são grandes demais.' });
    console.error(err);
    res.status(500).json({ erro: 'Algo deu errado no servidor. Tente de novo em instantes.' });
  });

  app.locals.ctx = ctx;
  return app;
}
