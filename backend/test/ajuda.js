import { abrirBanco } from '../src/db.js';
import { criarApp } from '../src/app.js';

export const MIN = 60_000;

/** Sobe a API numa porta livre, com banco em memória e relógio controlado. */
export async function criarAmbiente({ limites } = {}) {
  const relogio = {
    agora: Date.UTC(2026, 10, 19, 15, 0, 0),
    avancar(ms) {
      this.agora += ms;
    },
  };
  const db = abrirBanco(':memory:');
  const app = criarApp({ db, agora: () => relogio.agora, limites });
  const servidor = await new Promise((ok) => {
    const s = app.listen(0, '127.0.0.1', () => ok(s));
  });
  const base = `http://127.0.0.1:${servidor.address().port}`;

  /** Um "navegador": guarda o cookie entre as chamadas. */
  function cliente() {
    let cookie = '';
    async function req(metodo, caminho, corpo, { cru } = {}) {
      const res = await fetch(base + caminho, {
        method: metodo,
        headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
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
      get: (c) => req('GET', c),
      post: (c, b = {}, o) => req('POST', c, b, o),
      get cookie() {
        return cookie;
      },
      set cookie(v) {
        cookie = v;
      },
    };
  }

  return {
    db,
    relogio,
    cliente,
    fechar: () => new Promise((ok) => servidor.close(ok)),
  };
}

export const ANA = { nome: 'Ana Souza', usuario: 'ana_dev', email: 'ana@exemplo.com', senha: 'senha-forte-123' };
