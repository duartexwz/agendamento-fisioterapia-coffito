import { montarCalendario } from "./calendarioBase.js";

/**
 * Calendário da página pública (index.html).
 * Comunica os cliques para a UI (src/js/ui/page.js) por CustomEvents,
 * mantendo o componente desacoplado da página:
 * - "diaSelecionado"      → detail: { dia } (dia clicado em ISO).
 * - "sessaoCalendarioClicada" → detail: { id, dia } (evento clicado).
 */

const elemento = document.getElementById("calendarioEventos");

export const calendarioPublico = montarCalendario(elemento, {
  aoClicarDia(dia) {
    document.dispatchEvent(
      new CustomEvent("diaSelecionado", { detail: { dia } }),
    );
  },

  aoClicarEvento(sessao) {
    document.dispatchEvent(
      new CustomEvent("sessaoCalendarioClicada", { detail: sessao }),
    );
  },
});

/** Recarrega os eventos do calendário a partir da API. */
export function recarregarCalendario() {
  calendarioPublico?.refetchEvents();
}
