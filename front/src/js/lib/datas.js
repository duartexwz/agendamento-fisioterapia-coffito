/**
 * Utilitários de data compartilhados entre a página pública e o painel.
 * Todas as datas do sistema usam o formato ISO (YYYY-MM-DD), e os
 * horários chegam como HH:MM ou HH:MM:SS.
 */

/**
 * Data de hoje em ISO (YYYY-MM-DD), usando o fuso do navegador.
 * `toLocaleDateString('sv-SE')` produz exatamente o formato ISO.
 */
export function hojeISO() {
  return new Date().toLocaleDateString("sv-SE");
}

/**
 * Formata um dia ISO em português (pt-BR) com as opções desejadas.
 * Aceita datas com hora (ex.: 2026-11-10T00:00:00.000Z), usando apenas
 * os 10 primeiros caracteres para não mudar o dia com o fuso horário.
 *
 * @param {string} dia Data em ISO ou vazia.
 * @param {object} [opcoes] Opções repassadas a Date.toLocaleDateString.
 * @returns {string} Data formatada, ou o valor original se inválida.
 */
export function formatarData(dia, opcoes = {}) {
  if (!dia) return "";
  const data = new Date(`${String(dia).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(data.getTime())) return dia;

  return data.toLocaleDateString("pt-BR", opcoes);
}

/** Ex.: "segunda-feira, 10 de novembro de 2026". */
export function formatarDataLonga(dia) {
  return formatarData(dia, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Ex.: "segunda-feira, 10 de novembro" (sem o ano). */
export function formatarDataCurta(dia) {
  return formatarData(dia, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Reduz o horário a HH:MM, descartando segundos se vierem na API. */
export function formatarHorario(horario) {
  return String(horario ?? "").slice(0, 5);
}

/** Monta uma data-hora local (YYYY-MM-DDTHH:MM) para uma sessão. */
export function datetimeLocal(sessao) {
  return `${sessao.data.dia}T${sessao.data.horario}`;
}
