import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { criarLimitador, criarContadorJanela } from '../src/limite.js';

const relogio = (inicio = 0) => {
  const r = { t: inicio, agora: () => r.t };
  return r;
};

describe('limites em memória não crescem sem fim', () => {
  test('limitador: entradas vencidas são apagadas na varredura, mesmo de chaves que não voltam', () => {
    const r = relogio();
    const lim = criarLimitador({ maximo: 5, janelaMs: 1000, agora: r.agora });
    for (let i = 0; i < 3000; i++) lim.falhou(`email:${i}@x.com`);
    assert.equal(lim.tamanho, 3000);
    r.t += 1000; // a janela de todas passou
    lim.falhou('email:novo@x.com');
    assert.equal(lim.tamanho, 1);
  });

  test('limitador: a varredura não apaga quem ainda está bloqueado', () => {
    const r = relogio();
    const lim = criarLimitador({ maximo: 2, janelaMs: 1000, agora: r.agora });
    lim.falhou('velha');
    r.t += 600;
    lim.falhou('bloqueada');
    lim.falhou('bloqueada');
    r.t += 400; // 'velha' venceu; 'bloqueada' ainda tem 600 ms
    lim.falhou('outra');
    assert.equal(lim.tamanho, 2);
    assert.equal(lim.bloqueadoPor('bloqueada'), 1);
    assert.equal(lim.bloqueadoPor('velha'), 0);
  });

  test('limitador: com muitas chaves novas na mesma janela, o teto segura o tamanho', () => {
    const r = relogio();
    const lim = criarLimitador({ maximo: 5, janelaMs: 60_000, agora: r.agora, teto: 100 });
    for (let i = 0; i < 1000; i++) lim.falhou(`k${i}`);
    assert.equal(lim.tamanho, 100);
    // as mais recentes ficam
    for (let i = 0; i < 4; i++) lim.falhou('k999');
    assert.equal(lim.bloqueadoPor('k999') > 0, true);
  });

  test('contador de janela: conta, bloqueia, desfaz e varre o que venceu', () => {
    const r = relogio();
    const c = criarContadorJanela({ janelaMs: 1000, agora: r.agora });
    const a = c.reservar('ip1', 2);
    assert.ok(a.desfazer);
    c.reservar('ip1', 2);
    assert.equal(c.reservar('ip1', 2).esperaSegundos, 1);
    a.desfazer();
    assert.ok(c.reservar('ip1', 2).desfazer); // a vaga devolvida pode ser usada
    assert.ok(c.reservar('ip1', 0).desfazer); // 0 = sem limite

    for (let i = 0; i < 500; i++) c.reservar(`ip-${i}`, 10);
    assert.equal(c.tamanho, 501);
    r.t += 1000;
    c.reservar('ip-novo', 10);
    assert.equal(c.tamanho, 1);
  });

  test('contador de janela: teto', () => {
    const r = relogio();
    const c = criarContadorJanela({ janelaMs: 60_000, agora: r.agora, teto: 50 });
    for (let i = 0; i < 400; i++) c.reservar(`ip-${i}`, 10);
    assert.equal(c.tamanho, 50);
  });
});
