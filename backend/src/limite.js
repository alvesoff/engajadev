/**
 * Limite de tentativas de login, em memória.
 * Conta falhas por chave (e-mail ou IP) dentro de uma janela de tempo.
 * Ao chegar no máximo, a chave fica bloqueada até a janela acabar.
 */
export function criarLimitador({ maximo, janelaMs, agora }) {
  const falhas = new Map(); // chave -> { quantas, desde }

  function atual(chave) {
    const f = falhas.get(chave);
    if (!f) return null;
    if (agora() - f.desde >= janelaMs) {
      falhas.delete(chave);
      return null;
    }
    return f;
  }

  return {
    /** Segundos que faltam para liberar, ou 0 se a chave não está bloqueada. */
    bloqueadoPor(chave) {
      const f = atual(chave);
      if (!f || f.quantas < maximo) return 0;
      return Math.max(1, Math.ceil((f.desde + janelaMs - agora()) / 1000));
    },
    falhou(chave) {
      const f = atual(chave);
      if (f) f.quantas += 1;
      else falhas.set(chave, { quantas: 1, desde: agora() });
    },
    limpar(chave) {
      falhas.delete(chave);
    },
  };
}
