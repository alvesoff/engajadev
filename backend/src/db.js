import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  senha_hash TEXT NOT NULL,
  criado_em INTEGER NOT NULL
);

-- Guardamos só o sha256 do token: quem ler o banco não consegue usar a sessão.
CREATE TABLE IF NOT EXISTS sessoes (
  token_hash TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em INTEGER NOT NULL,
  expira_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessoes_usuario ON sessoes(usuario_id);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  url TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  rede TEXT NOT NULL,
  criado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_usuario ON posts(usuario_id, criado_em);

-- Uma curtida por pessoa por post. Descurtir só desliga (ativa = 0).
CREATE TABLE IF NOT EXISTS curtidas (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  ativa INTEGER NOT NULL DEFAULT 1,
  criado_em INTEGER NOT NULL,
  UNIQUE (post_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS curtidas_usuario ON curtidas(usuario_id, criado_em);

CREATE TABLE IF NOT EXISTS comentarios (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  criado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS comentarios_post ON comentarios(post_id);
CREATE INDEX IF NOT EXISTS comentarios_usuario ON comentarios(usuario_id, criado_em);

-- Livro-razão de pontos: cada ponto ganho é uma linha.
-- Rankings e carteira são somas sobre esta tabela; nada é apagado quando a semana vira.
CREATE TABLE IF NOT EXISTS lancamentos (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  papel TEXT NOT NULL CHECK (papel IN ('engajador', 'criador')),
  pontos INTEGER NOT NULL,
  post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  ref_tipo TEXT,
  ref_id INTEGER,
  criado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS lanc_usuario_tempo ON lancamentos(usuario_id, papel, criado_em);
CREATE INDEX IF NOT EXISTS lanc_papel_tempo ON lancamentos(papel, criado_em);
CREATE INDEX IF NOT EXISTS lanc_ref ON lancamentos(ref_tipo, ref_id);

-- Catálogo de prêmios (2ª fase). estoque NULL = sem limite.
-- tipo 'brinde' = algo entregue pela organização; 'destaque' = o post da pessoa fica no topo do feed por alguns dias.
CREATE TABLE IF NOT EXISTS premios (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  custo INTEGER NOT NULL CHECK (custo > 0),
  estoque INTEGER CHECK (estoque IS NULL OR estoque >= 0),
  tipo TEXT NOT NULL CHECK (tipo IN ('brinde', 'destaque')),
  dias_destaque INTEGER,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em INTEGER NOT NULL
);

-- Cada troca de pontos por um prêmio. O custo é copiado na hora do resgate,
-- para uma mudança de preço depois não mudar o histórico.
-- Os resgates NÃO entram em lancamentos: rankings e limites diários não mudam quando alguém resgata.
CREATE TABLE IF NOT EXISTS resgates (
  id INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  premio_id INTEGER NOT NULL REFERENCES premios(id),
  custo INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pendente', 'entregue', 'cancelado')),
  post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  destaque_ate INTEGER,
  criado_em INTEGER NOT NULL,
  atualizado_em INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS resgates_usuario ON resgates(usuario_id, status);
CREATE INDEX IF NOT EXISTS resgates_destaque ON resgates(destaque_ate);

-- Regras mudadas pela tela de admin. Valem por cima do config/regras.json.
CREATE TABLE IF NOT EXISTS regras_override (
  chave TEXT PRIMARY KEY,
  valor INTEGER NOT NULL,
  alterado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  alterado_em INTEGER NOT NULL
);
`;

export function abrirBanco(caminho = ':memory:') {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec('PRAGMA foreign_keys = ON;');
  if (caminho !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(ESQUEMA);
  migrar(db);
  return db;
}

/** Acrescenta colunas novas em bancos criados antes delas existirem. */
function migrar(db) {
  const colunas = (tabela) => new Set(db.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name));
  const posts = colunas('posts');
  // Moderação: post removido some do site, mas a linha fica (histórico e estorno de pontos).
  if (!posts.has('removido_em')) db.exec('ALTER TABLE posts ADD COLUMN removido_em INTEGER');
  if (!posts.has('removido_por')) db.exec('ALTER TABLE posts ADD COLUMN removido_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL');
  if (!posts.has('editado_em')) db.exec('ALTER TABLE posts ADD COLUMN editado_em INTEGER');
  if (!posts.has('removido_motivo')) db.exec("ALTER TABLE posts ADD COLUMN removido_motivo TEXT CHECK (removido_motivo IN ('autor', 'moderacao'))");
}

/** Roda fn dentro de uma transação: ou grava tudo, ou nada. */
export function transacao(db, fn) {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
