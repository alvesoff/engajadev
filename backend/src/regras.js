/**
 * Regras do jogo (valores padrão).
 * Comentar vale mais que curtir: dá mais trabalho e ajuda mais o autor.
 */
export const PADRAO = {
  pontos: {
    curtir: 1,
    comentar: 3,
    curtidaRecebida: 1,
    comentarioRecebido: 2,
    publicarPost: 0,
  },
  limites: {
    pontosDiariosEngajador: 30, // máximo por dia curtindo e comentando (0 = sem limite)
    pontosDiariosCriador: 60, // máximo por dia recebendo curtidas e comentários (0 = sem limite)
    cooldownSegundos: 10, // tempo mínimo entre duas curtidas ou comentários
    comentarioMinCaracteres: 20, // comentário mais curto é aceito, mas não pontua
    comentariosPontuadosPorPost: 1, // quantos comentários da mesma pessoa no mesmo post pontuam (0 = todos)
    postsPorDia: 5, // quantos links cada pessoa pode divulgar por dia (0 = sem limite)
  },
  periodo: {
    fusoHorarioMinutos: -180, // Brasília
    inicioSemanaDia: 1, // segunda-feira
    inicioSemanaHora: 0, // meia-noite
  },
  ranking: {
    limiarTopGeral: 10,
    tamanho: 50,
  },
  texto: {
    tituloMax: 120,
    descricaoMax: 500,
    comentarioMax: 1000,
  },
};

function mesclar(base, extra) {
  const out = {};
  for (const [grupo, valores] of Object.entries(base)) out[grupo] = { ...valores, ...extra?.[grupo] };
  return out;
}

/** @param {{ extra?: object }} opcoes extra: valores que valem por cima do padrão */
export function criarLeitorRegras({ extra } = {}) {
  const valor = mesclar(PADRAO, extra);
  const regras = () => valor;
  return regras;
}
