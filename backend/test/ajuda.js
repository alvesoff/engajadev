import { abrirBanco } from '../src/db.js';
import { criarApp } from '../src/app.js';

export const MIN = 60_000;
export const HORA = 60 * MIN;
export const DIA = 24 * HORA;
/** Quinta-feira, 19/11/2026, 12:00 em Brasília (15:00 UTC). */
export const QUINTA_MEIO_DIA = Date.UTC(2026, 10, 19, 15, 0, 0);

/** Sobe a API numa porta livre, com banco em memória e relógio controlado. */
export async function criarAmbiente({ limites, regras, inicio, arquivoRegras, admins } = {}) {
  const relogio = {
    agora: inicio ?? QUINTA_MEIO_DIA,
    avancar(ms) {
      this.agora += ms;
    },
  };
  const db = abrirBanco(':memory:');
  // Nos testes o cooldown e o limite de cadastros ficam desligados, a não ser que o teste peça.
  const regrasTeste = { ...regras, limites: { cooldownSegundos: 0, cadastrosPorIpHora: 0, ...regras?.limites } };
  const app = criarApp({ db, agora: () => relogio.agora, limites, regras: regrasTeste, arquivoRegras, admins });
  const servidor = await new Promise((ok) => {
    const s = app.listen(0, '127.0.0.1', () => ok(s));
  });
  const base = `http://127.0.0.1:${servidor.address().port}`;

  /** Um "navegador": guarda o cookie entre as chamadas. */
  function cliente() {
    let cookie = '';
    async function req(metodo, caminho, corpo, { cru, cabecalhos } = {}) {
      const res = await fetch(base + caminho, {
        method: metodo,
        headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...cabecalhos },
        body: cru ?? (corpo === undefined ? undefined : JSON.stringify(corpo)),
      });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) {
        const par = setCookie.split(';')[0];
        cookie = par.endsWith('=') ? '' : par;
      }
      const txt = await res.text();
      return { status: res.status, headers: res.headers, setCookie, texto: txt, body: txt ? JSON.parse(txt) : null };
    }
    return {
      get: (c, o) => req('GET', c, undefined, o),
      post: (c, b = {}, o) => req('POST', c, b, o),
      put: (c, b = {}, o) => req('PUT', c, b, o),
      del: (c, o) => req('DELETE', c, undefined, o),
      get cookie() {
        return cookie;
      },
      set cookie(v) {
        cookie = v;
      },
    };
  }

  /** Cria a conta de uma pessoa e devolve o "navegador" já conectado. */
  async function pessoa(apelido, extra = {}) {
    const c = cliente();
    const r = await c.post('/api/auth/cadastro', {
      nome: apelido[0].toUpperCase() + apelido.slice(1),
      usuario: apelido,
      email: `${apelido}@exemplo.com`,
      senha: 'senha-forte-123',
      ...extra,
    });
    if (r.status !== 201) throw new Error(`cadastro de ${apelido} falhou: ${r.texto}`);
    c.id = r.body.id;
    return c;
  }

  /** Publica um post e devolve o id. */
  let nPost = 0;
  async function postar(c, extra = {}) {
    nPost += 1;
    const r = await c.post('/api/posts', { url: `https://dev.to/teste/post-${nPost}`, titulo: `Post ${nPost}`, ...extra });
    if (r.status !== 201) throw new Error(`postar falhou: ${r.texto}`);
    return r.body.post.id;
  }

  /** Soma dos pontos de uma pessoa no livro-razão, por papel. */
  function pontosDe(id) {
    const linhas = db
      .prepare(`SELECT papel, COALESCE(SUM(pontos), 0) AS s FROM lancamentos WHERE usuario_id = ? GROUP BY papel`)
      .all(id);
    const out = { engajador: 0, criador: 0 };
    for (const l of linhas) out[l.papel] = l.s;
    return out;
  }

  return {
    db,
    relogio,
    cliente,
    pessoa,
    postar,
    pontosDe,
    fechar: () => new Promise((ok) => servidor.close(ok)),
  };
}

export const ANA = { nome: 'Ana Souza', usuario: 'ana_dev', email: 'ana@exemplo.com', senha: 'senha-forte-123' };
