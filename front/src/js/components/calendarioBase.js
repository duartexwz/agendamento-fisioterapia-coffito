import { buscarSessoes } from "../lib/app.js";
import { formatarHorario } from "../lib/datas.js";

/**
 * Configuração compartilhada do FullCalendar pelas duas páginas
 * (pública e admin). A página apenas informa, via callbacks, o que
 * fazer quando um dia ou uma sessão for clicado.
 *
 * Características:
 * - View mensal em pt-br, semana começando na segunda-feira.
 * - Eventos carregados da API por intervalo visível (start/end).
 * - Cores dos eventos conforme as vagas (vermelho/âmbar/verde).
 */

/**
 * Escolhe as cores de um evento conforme as vagas restantes.
 * 0 → vermelho (lotado); até 3 → âmbar; acima → verde.
 */
function coresSessao(vagas) {
  const total = Number(vagas) || 0;

  if (total === 0) {
    return { bg: "#fbdada", border: "#ef9a9a", text: "#b42318" };
  }

  if (total <= 3) {
    return { bg: "#fff1cc", border: "#f5c542", text: "#8a6100" };
  }

  return { bg: "#dff3e4", border: "#9fd3ab", text: "#1b6b34" };
}

/**
 * Converte uma sessão da API no formato de evento do FullCalendar.
 * O título já traz horário e vagas; extendedProps carrega as vagas para
 * a colorização em eventDidMount.
 */
function sessaoParaEvento(sessao) {
  const vagas = Number(sessao.vagas) || 0;

  return {
    id: String(sessao.id),
    title: `${formatarHorario(sessao.data.horario)} · ${vagas} ${vagas === 1 ? "vaga" : "vagas"}`,
    start: `${sessao.data.dia}T${sessao.data.horario}`,
    display: "block",
    extendedProps: { vagas },
  };
}

/**
 * Monta e renderiza um calendário FullCalendar no elemento informado.
 *
 * @param {HTMLElement} elemento Container onde o calendário será criado.
 * @param {object} [opcoes]
 * @param {(dia: string) => void} [opcoes.aoClicarDia]     Recebe o dia (ISO) clicado.
 * @param {(sessao: {id: string, dia: string}) => void} [opcoes.aoClicarEvento]
 *   Recebe id e dia da sessão clicada.
 * @param {number} [opcoes.contentHeight] Altura do conteúdo (padrão 430).
 * @returns {object|null} A instância do Calendar, ou null sem elemento/lib.
 */
export function montarCalendario(elemento, { aoClicarDia, aoClicarEvento, contentHeight = 430 } = {}) {
  if (!elemento || typeof FullCalendar === "undefined") return null;

  const calendario = new FullCalendar.Calendar(elemento, {
    contentHeight,
    initialView: "dayGridMonth",
    locale: "pt-br",
    firstDay: 1,
    headerToolbar: { start: "", center: "prev,title,next", end: "" },
    selectable: true,
    displayEventTime: false,

    // Dia em branco clicado.
    dateClick(info) {
      aoClicarDia?.(info.dateStr);
    },

    // Evento (sessão) clicado.
    eventClick(info) {
      info.jsEvent?.preventDefault();
      aoClicarEvento?.({
        id: info.event.id,
        dia: String(info.event.startStr).slice(0, 10),
      });
    },

    // Fonte de eventos assíncrona: busca da API as sessões do mês visível.
    async events(info, successCallback, failureCallback) {
      try {
        const sessoes = await buscarSessoes({
          start: info.startStr,
          end: info.endStr,
        });

        successCallback(sessoes.map(sessaoParaEvento));
      } catch (error) {
        console.error("Erro ao carregar as sessões do calendário:", error);
        failureCallback(error);
      }
    },

    // O tema do FullCalendar aplica cores por classe; usamos estilo inline
    // para manter as cores de vagas iguais nas duas páginas.
    eventDidMount(info) {
      const cores = coresSessao(info.event.extendedProps.vagas);
      const el = info.el;

      el.style.setProperty("background-color", cores.bg, "important");
      el.style.setProperty("border", `1px solid ${cores.border}`, "important");
      el.style.setProperty("color", cores.text, "important");
      el.style.setProperty("border-radius", "6px", "important");
      el.style.setProperty("font-size", "0.72rem", "important");
      el.style.setProperty("font-weight", "600", "important");
      el.style.setProperty("cursor", "pointer", "important");
      el.style.setProperty("overflow", "hidden", "important");
      el.style.setProperty("white-space", "nowrap", "important");
      el.style.setProperty("text-overflow", "ellipsis", "important");

      el.querySelectorAll("*").forEach((filho) => {
        filho.style.setProperty("color", cores.text, "important");
      });
    },
  });

  calendario.render();
  return calendario;
}
