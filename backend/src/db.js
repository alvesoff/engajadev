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
`;

export function abrirBanco(caminho = ':memory:') {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec('PRAGMA foreign_keys = ON;');
  if (caminho !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(ESQUEMA);
  return db;
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
