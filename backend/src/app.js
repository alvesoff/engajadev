import express from 'express';
import { ErroHttp } from './erros.js';
import { carregarSessao, rotasAuth } from './rotas/auth.js';

/**
 * Monta a aplicação.
 * @param {object} opcoes
 * @param {import('node:sqlite').DatabaseSync} opcoes.db
 * @param {() => number} [opcoes.agora] relógio em ms (dá para trocar nos testes)
 * @param {object} [opcoes.limites] limite de tentativas de login { porEmail, porIp, janelaMs }
 * @param {boolean|string|number} [opcoes.trustProxy] valor do "trust proxy" do Express
 */
export function criarApp({ db, agora = () => Date.now(), limites, trustProxy = false } = {}) {
  const ctx = { db, agora };

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use(express.json({ limit: '10kb' }));
  app.use(carregarSessao(ctx));

  app.use('/api/auth', rotasAuth(ctx, limites));
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
