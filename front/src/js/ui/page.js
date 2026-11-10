/**
 * Controller da página pública de agendamento (index.html).
 *
 * Fluxo do usuário:
 * 1. Escolhe um dia no calendário (ou clica direto numa sessão).
 * 2. Vê as sessões do dia, podendo filtrar por modalidade.
 * 3. Seleciona uma sessão com vagas e preencha nome + setor.
 * 4. Confirma o agendamento (POST /participantes).
 *
 * Estado em memória: dia atual, filtro de modalidade, sessões do dia e
 * mapa id→nome de profissionais (para exibir quem atende cada sessão).
 */
import {
  buscarProfissionais,
  buscarSessoes,
  cadastrarParticipante,
  getSessaoSelecionada,
  limparSessaoSelecionada,
  mensagemErro,
  setSessaoSelecionada,
} from "../lib/app.js";
import { formatarDataCurta, hojeISO, formatarHorario } from "../lib/datas.js";
import { escapeHTML, normalizar, notificar } from "../lib/utils.js";
import { recarregarCalendario } from "../components/calendario.js";

/* =========================
   Estado da página pública
   ========================= */

let diaAtual = hojeISO();
let modalidadeAtiva = "Todas";
let sessoesDoDia = [];
let profissionaisPorId = {};

const elementos = {
  horarios: document.getElementById("horarios"),
  filtros: document.getElementById("spanSessoesDia"),
  contador: document.getElementById("sessao"),
  labelDia: document.getElementById("dataDiaSelecionado"),
  resumo: document.getElementById("resumoGeral"),
  botaoEnviar: document.getElementById("enviarCadastro"),
  form: document.querySelector(".cadastro-sessao"),
  inputNome: document.getElementById("nomeCadastro") || document.getElementById("nameCadastro"),
  inputSetor: document.getElementById("setorCadastro"),
};

/* =========================
   Renderização
   ========================= */

/** Informa se a sessão é a atualmente selecionada (destaque visual). */
function sessionEstaSelecionada(sessao) {
  return String(getSessaoSelecionada()?.id) === String(sessao.id);
}

/**
 * Renderiza os botões de filtro por modalidade do dia carregado.
 * Se a modalidade ativa desapareceu da lista, volta para "Todas".
 */
function renderizarFiltros() {
  if (!elementos.filtros) return;

  const modalidades = [
    ...new Set(sessoesDoDia.map((sessao) => sessao.modalidade).filter(Boolean)),
  ];

  const modalidadeAindaExiste = modalidades.some(
    (modalidade) => normalizar(modalidade) === normalizar(modalidadeAtiva),
  );

  if (modalidadeAtiva !== "Todas" && !modalidadeAindaExiste) {
    modalidadeAtiva = "Todas";
  }

  const opcoes = ["Todas", ...modalidades];

  elementos.filtros.innerHTML = opcoes
    .map(
      (modalidade) => `
        <button
          type="button"
          class="sessoes-dia ${normalizar(modalidade) === normalizar(modalidadeAtiva) ? "ativa" : ""}"
          data-modalidade="${escapeHTML(modalidade)}"
        >
          ${escapeHTML(modalidade)}
        </button>
      `,
    )
    .join("");
}

/** Aplica o filtro de modalidade sobre as sessões do dia. */
function sessoesFiltradas() {
  if (modalidadeAtiva === "Todas") return sessoesDoDia;

  return sessoesDoDia.filter(
    (sessao) => normalizar(sessao.modalidade) === normalizar(modalidadeAtiva),
  );
}

/** Classe CSS de cor conforme as vagas: lotada | poucas-vagas | com-vagas. */
function classesDeVagas(vagas) {
  const total = Number(vagas) || 0;

  if (total === 0) return "lotada";
  if (total <= 3) return "poucas-vagas";
  return "com-vagas";
}

/** Texto de vagas exibido no card: "Lotado" ou "N vaga(s)". */
function textoDeVagas(vagas) {
  const total = Number(vagas) || 0;

  if (total === 0) return "Lotado";
  return `${total} ${total === 1 ? "vaga" : "vagas"}`;
}

/**
 * Renderiza a lista de sessões do dia (após o filtro de modalidade).
 * Cada card é clicável (role="button") e traz data, horário, vagas,
 * barra de preenchimento e dados do profissional.
 */
function renderizarSessoes() {
  if (!elementos.horarios) return;

  const sessoes = sessoesFiltradas();

  if (sessoes.length === 0) {
    elementos.horarios.innerHTML = `
      <div class="container-sem-sessao">
        <div class="sem-sessao">
          <p class="sem-sessoes">Nenhuma sessão encontrada para este filtro.</p>
        </div>
      </div>`;
    return;
  }

  elementos.horarios.innerHTML = sessoes
    .map((sessao) => {
      const vagas = Number(sessao.vagas) || 0;
      const total = Number(sessao.vagas_totais) || Math.max(vagas, 1);
      const preenchimento = Math.round((vagas / total) * 100);
      const selecionada = sessionEstaSelecionada(sessao) ? "selecionada" : "";
      const esgotada = vagas === 0 ? "esgotada" : "";

      return `
        <div
          class="sessoes-horarios ${classesDeVagas(vagas)} ${selecionada} ${esgotada}"
          data-id="${escapeHTML(sessao.id)}"
          data-nome="${escapeHTML(sessao.nome)}"
          data-dia="${escapeHTML(sessao.dia)}"
          data-horario="${escapeHTML(formatarHorario(sessao.horario))}"
          data-profissional="${escapeHTML(sessao.profissional)}"
          data-vagas="${vagas}"
          data-modalidade="${escapeHTML(sessao.modalidade)}"
          role="button"
          tabindex="0"
          aria-disabled="${vagas === 0}"
        >
          <div class="horario">
            <p>${escapeHTML(formatarDataCurta(sessao.dia))} - ${escapeHTML(formatarHorario(sessao.horario))}</p>
            <span class="vagas">${escapeHTML(textoDeVagas(vagas))}</span>
          </div>
          <div class="nome-sessao">
            <h5>${escapeHTML(sessao.nome)}</h5>
            <p>${escapeHTML(sessao.profissional)} · ${escapeHTML(sessao.modalidade)}</p>
          </div>
          <div class="barra-vagas" title="${vagas} de ${total} vagas disponíveis">
            <div class="preenchimento" style="width: ${preenchimento}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

/** Atualiza o cabeçalho: dia selecionado e total de sessões. */
function renderizarCabecalho() {
  if (elementos.labelDia) {
    elementos.labelDia.textContent = formatarDataCurta(diaAtual);
  }

  if (elementos.contador) {
    const total = sessoesDoDia.length;
    elementos.contador.textContent = `${total} ${total === 1 ? "Sessão" : "Sessões"}`;
  }
}

/**
 * Painel lateral com o resumo do agendamento: dados da sessão
 * selecionada e estado do botão de confirmação (desabilitado sem
 * seleção ou com sessão lotada).
 */
function renderizarResumo() {
  if (!elementos.resumo || !elementos.botaoEnviar) return;

  const sessao = getSessaoSelecionada();

  if (!sessao) {
    elementos.resumo.innerHTML = `
      <h4>RESUMO DO AGENDAMENTO</h4>
      <p class="resumo-vazio">Selecione uma sessão ao lado.</p>
    `;
    elementos.botaoEnviar.disabled = true;
    return;
  }

  const vagas = Number(sessao.vagas) || 0;
  const lotada = vagas === 0;

  elementos.resumo.innerHTML = `
    <h4>RESUMO DO AGENDAMENTO</h4>
    <p><strong>Sessão:</strong> ${escapeHTML(sessao.nome)}</p>
    <p><strong>Modalidade:</strong> ${escapeHTML(sessao.modalidade)}</p>
    <p><strong>Data:</strong> ${escapeHTML(formatarDataCurta(sessao.dia))}</p>
    <p><strong>Horário:</strong> ${escapeHTML(sessao.horario)}</p>
    <p><strong>Profissional:</strong> ${escapeHTML(sessao.profissional)}</p>
    <p><strong>Vagas:</strong> ${escapeHTML(textoDeVagas(vagas))}</p>
    ${lotada ? '<p class="resumo-lotado">Esta sessão não possui mais vagas.</p>' : ""}
  `;

  elementos.botaoEnviar.disabled = lotada;
}

/* =========================
   Ações
   ========================= */

/**
 * Seleciona uma sessão para o agendamento (bloqueia sessões lotadas)
 * e re-renderiza a lista e o resumo.
 */
function selecionarSessao(sessao) {
  if (Number(sessao.vagas) === 0) {
    notificar("Esta sessão está lotada. Escolha outra sessão.", "aviso");
    return;
  }

  setSessaoSelecionada(sessao);
  renderizarSessoes();
  renderizarResumo();
}

/** Limpa a seleção de sessão e o destaque visual dos cards. */
function limparSelecao() {
  limparSessaoSelecionada();
  document
    .querySelectorAll(".sessoes-horarios.selecionada")
    .forEach((el) => el.classList.remove("selecionada"));
  renderizarResumo();
}

/**
 * Seleciona uma sessão por id (clique em evento do calendário),
 * trocando de dia antes se necessário.
 */
async function selecionarSessaoPorId(id, dia) {
  if (dia && dia !== diaAtual) {
    await carregarDia(dia);
  }

  const sessao = sessoesDoDia.find((item) => String(item.id) === String(id));
  if (sessao) selecionarSessao(sessao);
}

/**
 * Carrega todas as sessões/profissionais da API e monta `sessoesDoDia`
 * (normalizada, com nome do profissional) para o dia informado,
 * atualizando filtros, lista e cabeçalho. Em erro, esvazia a lista e
 * notifica o usuário.
 */
async function carregarDia(dia) {
  const mudouDeDia = dia !== diaAtual;
  diaAtual = dia;

  if (mudouDeDia) limparSelecao();

  try {
    const [sessoes, profissionais] = await Promise.all([
      buscarSessoes(),
      buscarProfissionais(),
    ]);

    profissionaisPorId = Object.fromEntries(
      profissionais.map((profissional) => [profissional.id, profissional.nome]),
    );

    sessoesDoDia = sessoes
      .filter((sessao) => sessao.data?.dia === dia)
      .map((sessao) => ({
        id: sessao.id,
        nome: sessao.nome,
        dia: sessao.data.dia,
        horario: formatarHorario(sessao.data.horario),
        modalidade: sessao.modalidade,
        profissional:
          profissionaisPorId[sessao.profissional_id] || "Profissional não encontrado",
        vagas: Number(sessao.vagas) || 0,
        vagas_totais: Number(sessao.vagas_totais) || Number(sessao.vagas) || 0,
      }))
      .sort((a, b) => a.horario.localeCompare(b.horario));

    renderizarFiltros();
    renderizarSessoes();
    renderizarCabecalho();
  } catch (error) {
    console.error("Erro ao carregar o dia:", error);

    sessoesDoDia = [];
    renderizarFiltros();
    renderizarCabecalho();

    if (elementos.horarios) {
      elementos.horarios.innerHTML = `
        <div class="container-sem-sessao">
          <div class="sem-sessao">
            <p class="sem-sessoes">${escapeHTML(mensagemErro(error, "Erro ao carregar as sessões."))}</p>
          </div>
        </div>`;
    }

    notificar(mensagemErro(error, "Erro ao carregar as sessões."), "erro");
  }
}

/**
 * Confirma o agendamento: valida sessão selecionada + nome/setor,
 * chama POST /participantes, limpa o formulário e recarrega o dia e o
 * calendário para refletir a vaga consumida.
 */
async function enviarAgendamento(event) {
  event.preventDefault();

  const sessao = getSessaoSelecionada();
  if (!sessao) {
    notificar("Selecione uma sessão antes de confirmar.", "aviso");
    return;
  }

  const nome = elementos.inputNome?.value.trim();
  const setor = elementos.inputSetor?.value.trim();

  if (!nome || !setor) {
    notificar("Preencha seu nome e o setor onde trabalha.", "aviso");
    elementos.inputNome?.focus();
    return;
  }

  if (elementos.botaoEnviar) elementos.botaoEnviar.disabled = true;

  try {
    await cadastrarParticipante({
      nome,
      setor,
      sessao_id: sessao.id,
    });

    if (elementos.inputNome) elementos.inputNome.value = "";
    if (elementos.inputSetor) elementos.inputSetor.value = "";

    notificar("Agendamento confirmado com sucesso!", "sucesso");

    limparSelecao();
    await carregarDia(diaAtual);
    recarregarCalendario();
  } catch (error) {
    console.error("Erro ao cadastrar participante:", error);
    notificar(mensagemErro(error, "Erro ao confirmar o agendamento."), "erro");
  } finally {
    const selecionada = getSessaoSelecionada();
    if (elementos.botaoEnviar) {
      elementos.botaoEnviar.disabled = !selecionada || Number(selecionada.vagas) === 0;
    }
  }
}

/* =========================
   Eventos da interface
   ========================= */

document.addEventListener("diaSelecionado", (event) => {
  const dia = event.detail?.dia;
  if (dia) carregarDia(dia);
});

document.addEventListener("sessaoCalendarioClicada", (event) => {
  const { id, dia } = event.detail ?? {};
  if (id) selecionarSessaoPorId(id, dia);
});

elementos.filtros?.addEventListener("click", (event) => {
  const botao = event.target.closest(".sessoes-dia");
  if (!botao) return;

  modalidadeAtiva = botao.dataset.modalidade || "Todas";
  renderizarFiltros();
  renderizarSessoes();
});

elementos.horarios?.addEventListener("click", (event) => {
  const card = event.target.closest(".sessoes-horarios");
  if (!card) return;

  const sessao = sessoesDoDia.find(
    (item) => String(item.id) === String(card.dataset.id),
  );

  if (sessao) selecionarSessao(sessao);
});

elementos.horarios?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;

  const card = event.target.closest(".sessoes-horarios");
  if (!card) return;

  event.preventDefault();
  card.click();
});

elementos.form?.addEventListener("submit", enviarAgendamento);

/* =========================
   Inicialização
   ========================= */

renderizarResumo();
carregarDia(hojeISO());
