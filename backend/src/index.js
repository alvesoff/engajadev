import { abrirBanco } from './db.js';
import { criarApp } from './app.js';

const porta = Number(process.env.PORT) || 4400;
const caminhoBanco = process.env.DB_PATH || './data/engajadev.db';
const trustProxy = process.env.TRUST_PROXY ?? false;

const db = abrirBanco(caminhoBanco);
const app = criarApp({ db, trustProxy });

app.listen(porta, () => {
  console.log(`EngajaDev API em http://localhost:${porta}`);
});
