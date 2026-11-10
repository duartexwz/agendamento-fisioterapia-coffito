import { montarCalendario } from "./calendarioBase.js";

/**
 * Calendário do painel administrativo (admin.html).
 * - Clicar em um dia abre o painel lateral "Eventos do dia selecionado"
 *   e o resumo das sessões daquele dia.
 * - Clicar em uma sessão abre os detalhes e a lista de participantes.
 *
 * Comunica os cliques para a UI (src/js/ui/admin.js) por CustomEvents:
 * - "diaAdminSelecionado"   → detail: { dia } (dia em ISO).
 * - "sessaoAdminSelecionada" → detail: { id, dia } (sessão clicada).
 */

const elemento = document.getElementById("calendarioEventos");

export const calendarioAdmin = montarCalendario(elemento, {
  contentHeight: 620,

  aoClicarDia(dia) {
    document.dispatchEvent(
      new CustomEvent("diaAdminSelecionado", { detail: { dia } }),
    );
  },

  aoClicarEvento(sessao) {
    document.dispatchEvent(
      new CustomEvent("sessaoAdminSelecionada", { detail: sessao }),
    );
  },
});

/** Recarrega os eventos do calendário a partir da API. */
export function recarregarCalendarioAdmin() {
  calendarioAdmin?.refetchEvents();
}
