const DIA = 86_400_000;
const MIN = 60_000;

/** Início (ms UTC) do dia local que contém `ms`, no fuso dado em minutos (-180 = Brasília). */
export function inicioDoDia(ms, fusoMin) {
  const local = ms + fusoMin * MIN;
  return Math.floor(local / DIA) * DIA - fusoMin * MIN;
}

/**
 * Início (ms UTC) da semana que contém `ms`.
 * inicioSemanaDia: 0 = domingo, 1 = segunda ... 6 = sábado. inicioSemanaHora: 0 a 23 (hora local).
 */
export function inicioDaSemana(ms, { fusoHorarioMinutos, inicioSemanaDia, inicioSemanaHora }) {
  const fuso = fusoHorarioMinutos * MIN;
  const hora = inicioSemanaHora * 3_600_000;
  const local = ms + fuso - hora;
  const diaLocal = Math.floor(local / DIA) * DIA;
  const diaDaSemana = new Date(diaLocal).getUTCDay();
  const recuo = (diaDaSemana - inicioSemanaDia + 7) % 7;
  return diaLocal - recuo * DIA + hora - fuso;
}

/** Janela [inicio, fim) do período. A semana anda sozinha; o geral começa no zero e não acaba. */
export function janela(periodo, ms, p) {
  if (periodo === 'semana') {
    const inicio = inicioDaSemana(ms, p);
    return { inicio, fim: inicio + 7 * DIA };
  }
  return { inicio: 0, fim: null };
}
