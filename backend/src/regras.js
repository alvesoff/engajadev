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
  texto: {
    tituloMax: 120,
    descricaoMax: 500,
    comentarioMax: 1000,
  },
};

export function criarLeitorRegras() {
  const regras = () => PADRAO;
  return regras;
}
