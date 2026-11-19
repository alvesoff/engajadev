/**
 * Limites em memória (login, troca de senha, contas novas por IP).
 *
 * A memória não cresce sem fim:
 * - de tempos em tempos as entradas vencidas são apagadas (varredura);
 * - se mesmo assim passar de `teto` chaves (muitas chaves novas dentro da mesma janela,
 *   como num ataque espalhado), as mais antigas saem primeiro.
 */
const TETO_PADRAO = 50_000;

/** Varre `mapa` apagando o que `vencida(valor)` disser, no máximo uma vez a cada `intervaloMs`. */
function criarFaxina({ mapa, agora, intervaloMs, teto, vencida }) {
  let ultima = agora();
  return function faxinar() {
    if (agora() - ultima >= intervaloMs) {
      ultima = agora();
      for (const [chave, valor] of mapa) if (vencida(valor)) mapa.delete(chave);
    }
    // Map guarda a ordem de entrada: a primeira chave é a mais antiga.
    while (mapa.size > teto) mapa.delete(mapa.keys().next().value);
  };
}

/**
 * Limite de tentativas que falharam (login, troca de senha).
 * Conta falhas por chave (e-mail, IP...) dentro de uma janela de tempo.
 * Ao chegar no máximo, a chave fica bloqueada até a janela acabar.
 */
export function criarLimitador({ maximo, janelaMs, agora, teto = TETO_PADRAO }) {
  const falhas = new Map(); // chave -> { quantas, desde }
  const vencida = (f) => agora() - f.desde >= janelaMs;
  const faxinar = criarFaxina({ mapa: falhas, agora, intervaloMs: janelaMs, teto, vencida });

  function atual(chave) {
    const f = falhas.get(chave);
    if (!f) return null;
    if (vencida(f)) {
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
      faxinar();
    },
    limpar(chave) {
      falhas.delete(chave);
    },
    /** Quantas chaves estão guardadas (para os testes). */
    get tamanho() {
      return falhas.size;
    },
  };
}

/**
 * Contador de acontecimentos por chave numa janela deslizante (ex.: contas criadas por IP na última hora).
 * `reservar` já conta o acontecimento e devolve uma função para desfazer, caso ele não se confirme.
 */
export function criarContadorJanela({ janelaMs, agora, teto = TETO_PADRAO }) {
  const eventos = new Map(); // chave -> [instantes]
  const vencida = (lista) => !lista.length || agora() - lista[lista.length - 1] >= janelaMs;
  const faxinar = criarFaxina({ mapa: eventos, agora, intervaloMs: janelaMs, teto, vencida });

  function recentes(chave) {
    const desde = agora() - janelaMs;
    const lista = (eventos.get(chave) ?? []).filter((t) => t > desde);
    if (lista.length) eventos.set(chave, lista);
    else eventos.delete(chave);
    return lista;
  }

  return {
    /**
     * Se a chave já tem `maximo` acontecimentos na janela, devolve os segundos de espera.
     * Senão, conta mais um e devolve { desfazer }. maximo 0 = sem limite.
     */
    reservar(chave, maximo) {
      const lista = recentes(chave);
      if (maximo > 0 && lista.length >= maximo) {
        return { esperaSegundos: Math.max(1, Math.ceil((lista[0] + janelaMs - agora()) / 1000)) };
      }
      const instante = agora();
      // apaga e põe de novo: a chave vai para o fim da fila (a mais recente)
      eventos.delete(chave);
      eventos.set(chave, [...lista, instante]);
      faxinar();
      return {
        desfazer() {
          const atual = eventos.get(chave) ?? [];
          const i = atual.indexOf(instante);
          if (i >= 0) atual.splice(i, 1);
          if (!atual.length) eventos.delete(chave);
        },
      };
    },
    get tamanho() {
      return eventos.size;
    },
  };
}
