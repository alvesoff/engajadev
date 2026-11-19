import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from '../src/db.js';
import { semear } from '../src/semear.js';

test('semear preenche um banco vazio e recusa banco com contas', async () => {
  const db = abrirBanco(':memory:');
  const r = await semear(db);
  assert.deepEqual(r, { pessoas: 6, posts: 8, acoes: 31, premios: 4 });
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM lancamentos').get();
  assert.ok(n > 0);
  await assert.rejects(() => semear(db), /já tem contas/);
});
