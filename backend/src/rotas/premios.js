import { Router } from 'express';
import { erro } from '../erros.js';
import { exigirLogin } from './auth.js';
import { premioPublico, resgatar, listarResgates, mudarStatus, validarPremio, STATUS } from '../premios.js';

export function rotasPremios(ctx) {
  const r = Router();
  const admin = (req, _res, next) => {
    if (!ctx.ehAdmin(req.usuario)) return next(erro(403, 'Só quem administra pode cuidar dos prêmios.'));
    next();
  };

  // Catálogo público: só os prêmios ativos, do mais barato para o mais caro.
  r.get('/premios', (_req, res) => {
    const premios = ctx.db.prepare('SELECT * FROM premios WHERE ativo = 1 ORDER BY custo, id').all().map(premioPublico);
    res.json({ premios });
  });

  r.post('/premios/:id/resgatar', exigirLogin, (req, res) => {
    const resultado = resgatar(ctx, req.usuario, req.params.id, { postId: req.body?.postId });
    res.status(201).json(resultado);
  });

  // ---- admin ----
  r.get('/admin/premios', exigirLogin, admin, (_req, res) => {
    res.json({ premios: ctx.db.prepare('SELECT * FROM premios ORDER BY ativo DESC, custo, id').all().map(premioPublico) });
  });

  r.post('/admin/premios', exigirLogin, admin, (req, res) => {
    const p = validarPremio(req.body ?? {});
    const { lastInsertRowid } = ctx.db
      .prepare(
        `INSERT INTO premios (nome, descricao, custo, estoque, tipo, dias_destaque, ativo, criado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(p.nome, p.descricao, p.custo, p.estoque, p.tipo, p.diasDestaque, p.ativo ? 1 : 0, ctx.agora());
    res.status(201).json(premioPublico(ctx.db.prepare('SELECT * FROM premios WHERE id = ?').get(lastInsertRowid)));
  });

  r.put('/admin/premios/:id', exigirLogin, admin, (req, res) => {
    const atual = ctx.db.prepare('SELECT * FROM premios WHERE id = ?').get(Number(req.params.id) || 0);
    if (!atual) throw erro(404, 'Prêmio não encontrado.');
    const p = validarPremio(req.body ?? {}, premioPublico(atual));
    ctx.db
      .prepare('UPDATE premios SET nome = ?, descricao = ?, custo = ?, estoque = ?, tipo = ?, dias_destaque = ?, ativo = ? WHERE id = ?')
      .run(p.nome, p.descricao, p.custo, p.estoque, p.tipo, p.diasDestaque, p.ativo ? 1 : 0, atual.id);
    res.json(premioPublico(ctx.db.prepare('SELECT * FROM premios WHERE id = ?').get(atual.id)));
  });

  r.get('/admin/resgates', exigirLogin, admin, (req, res) => {
    const status = STATUS.includes(req.query.status) ? req.query.status : undefined;
    res.json({ resgates: listarResgates(ctx, { status }) });
  });

  r.put('/admin/resgates/:id', exigirLogin, admin, (req, res) => {
    res.json(mudarStatus(ctx, req.params.id, req.body?.status));
  });

  return r;
}
