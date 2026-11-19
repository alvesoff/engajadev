import { abrirBanco } from './db.js';
import { criarApp } from './app.js';

const porta = Number(process.env.PORT) || 4400;
const caminhoBanco = process.env.DB_PATH || './data/engajadev.db';
// TRUST_PROXY: "true"/"false", um número de proxies (ex.: "1") ou uma lista de IPs.
function lerTrustProxy(valor) {
  if (valor === undefined || valor === '' || valor === 'false') return false;
  if (valor === 'true') return true;
  if (/^\d+$/.test(valor)) return Number(valor);
  return valor;
}
const trustProxy = lerTrustProxy(process.env.TRUST_PROXY);

const arquivoRegras = process.env.REGRAS_PATH || './config/regras.json';
const admins = (process.env.ADMIN_EMAILS ?? '').split(',');

const db = abrirBanco(caminhoBanco);
const app = criarApp({ db, trustProxy, arquivoRegras, admins });

app.listen(porta, () => {
  console.log(`EngajaDev API em http://localhost:${porta}`);
});
