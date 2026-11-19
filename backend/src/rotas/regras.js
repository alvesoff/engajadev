import { Router } from 'express';
import { erro } from '../erros.js';
import { transacao } from '../db.js';
import { validar, achatar, ESQUEMA } from '../regras.js';
import { exigirLogin } from './auth.js';

function exigirAdmin(ctx) {
  return (req, _res, next) => {
    if (!ctx.ehAdmin(req.usuario)) return next(erro(403, 'Só quem administra pode ver e mudar as regras.'));
    next();
  };
}

export function rotasRegras(ctx) {
  const r = Router();
  const admin = exigirAdmin(ctx);

  // Regras em vigor, públicas: a tela "Como pontuar" lê daqui.
  r.get('/regras', (_req, res) => res.json(ctx.regras()));

  r.get('/admin/regras', exigirLogin, admin, (_req, res) => res.json({ regras: ctx.regras.detalhe() }));

  /**
   * Muda regras. Aceita { "pontos.curtir": 2 } ou { pontos: { curtir: 2 } }.
   * Valor null tira a mudança feita pelo admin e volta ao arquivo ou ao padrão.
   */
  r.put('/admin/regras', exigirLogin, admin, (req, res) => {
    const corpo = req.body && typeof req.body === 'object' ? req.body : {};
    const plano = {};
    for (const [k, v] of Object.entries(corpo)) {
      if (!k.includes('.') && v && typeof v === 'object') Object.assign(plano, achatar({ [k]: v }));
      else plano[k] = v;
    }
    const erros = [];
    const gravar = [];
    const remover = [];
    for (const [chave, valor] of Object.entries(plano)) {
      if (!ESQUEMA[chave]) erros.push(`Regra desconhecida: ${chave}.`);
      else if (valor === null) remover.push(chave);
      else {
        const v = validar(chave, valor);
        if (v.ok) gravar.push([chave, v.valor]);
        else erros.push(v.erro);
      }
    }
    if (erros.length) throw erro(400, erros.join(' '), { erros });
    transacao(ctx.db, () => {
      const up = ctx.db.prepare(
        `INSERT INTO regras_override (chave, valor, alterado_por, alterado_em) VALUES (?, ?, ?, ?)
         ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor,
           alterado_por = excluded.alterado_por, alterado_em = excluded.alterado_em`,
      );
      for (const [chave, valor] of gravar) up.run(chave, valor, req.usuario.id, ctx.agora());
      const del = ctx.db.prepare('DELETE FROM regras_override WHERE chave = ?');
      for (const chave of remover) del.run(chave);
    });
    res.json({ regras: ctx.regras.detalhe() });
  });

  return r;
}
