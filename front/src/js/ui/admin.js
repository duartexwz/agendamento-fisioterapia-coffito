/**
 * Controller do painel administrativo (admin.html).
 *
 * Responsabilidades:
 * - Autenticação: valida a sessão ao entrar e permite sair da conta.
 * - Calendário: escuta os CustomEvents dos componentes e abre painéis
 *   de resumo do dia / detalhes da sessão com participantes.
 * - Painel lateral "Eventos do dia selecionado": ao abrir a página traz
 *   os 3 eventos mais próximos da data atual; ao clicar em um dia passa
 *   a exibir os eventos daquele dia (sempre atualizado após mutações).
 * - Cadastros via modais: eventos/sessões, profissionais e administradores.
 *
 * O HTML das modais de detalhes é montado dinamicamente em
 * `#dialogEventos`; as demais (<dialog>) já existem no admin.html.
 */
import {
  buscarParticipantes,
  buscarProfissionais,
  buscarSessoes,
  cadastrarProfissional,
  cadastrarSessao,
  mensagemErro,
  removerParticipante,
  removerProfissional,
  removerSessao,
  buscarUsuarioAtual,
  estaAutenticado,
  limparSessaoAutenticada,
  obterUsuarioAutenticado,
  buscarAdministradores,
  cadastrarAdministrador,
  atualizarAdministrador,
  removerAdministrador,
} from "../lib/app.js";
import { formatarDataLonga, formatarHorario, hojeISO } from "../lib/datas.js";
import { escapeHTML, notificar } from "../lib/utils.js";
import { confirmar } from "../lib/modal.js";
import { recarregarCalendarioAdmin } from "../components/calendarioAdmin.js";

/* =========================
   Elementos
   ========================= */

const elementos = {
  botaoNovoEvento: document.getElementById("novoEvento"),
  botaoNovoProfissional: document.getElementById("novoProfissional"),
  modalEvento: document.querySelector(".evento-dialog"),
  modalProfissional: document.getElementById("dialogProfissional"),
  modalDetalhes: document.getElementById("dialogEventos"),
  listaEventosDia: document.getElementById("listaEventosDia"),
  dataEventosSelecionados: document.getElementById("dataEventosSelecionados"),
  formEvento: document.getElementById("cadastroEvento"),
  formProfissional: document.getElementById("formProfissionais"),
  tabelaProfissionais: document.getElementById("corpoTable"),
  tabelaAdministradores: document.getElementById("corpoAdministradores"),
  selectProfissional: document.getElementById("selectProfissional"),
  inputNomeEvento: document.getElementById("nomeEvento"),
  inputDataEvento: document.getElementById("dateEvent"),
  inputHorarioEvento: document.getElementById("horarioSessao"),
  inputVagas: document.getElementById("vagasSessao"),
  inputModalidade: document.getElementById("modalidadeSessao"),
  inputNomeProfissional: document.getElementById("nomeProfissional"),
  inputProfissao: document.getElementById("profissaoProfissional"),
  adicionarAdministrador: document.getElementById('novoAdministrador'),
  dialogNovoAdmin: document.getElementById('novoAdmin'),
  formAdmin: document.getElementById('cadastroAdmin'),
  nomeAdmin: document.getElementById('inputNomeAdmin'),
  emailAdmin: document.getElementById('inputEmailAdmin'),
  senhaAdmin: document.getElementById('inputSenhaAdmin'),
  btnCadastrarAdmin: document.getElementById('btnCadastrarAdmin'),

};

/* =========================
   Administrador
   ========================= */

let adminEditandoId = null;

/**
 * Monta as linhas da tabela de administradores com botões
 * Editar/Remover (delegação via data-editar-admin / data-remover-admin).
 */
function renderizarAdministradores(administradores) {
  if (!elementos.tabelaAdministradores) return;

  elementos.tabelaAdministradores.innerHTML =
    administradores.length > 0
      ? administradores
          .map(
            (admin, indice) => `
              <tr class="body-table">
                <td>${indice + 1}</td>
                <td>${escapeHTML(admin.nome)}</td>
                <td>${escapeHTML(admin.email)}</td>
                <td>
                  <button
                    type="button"
                    class="btn-secundario btn-compacto"
                    data-editar-admin="${escapeHTML(admin.id)}"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    class="btn-remover"
                    data-remover-admin="${escapeHTML(admin.id)}"
                  >
                    Remover
                  </button>
                </td>
              </tr>
            `,
          )
          .join("")
      : `<tr><td colspan="4" class="tabela-vazia">Nenhum administrador cadastrado.</td></tr>`;
}

/** GET /auth/usuarios → atualiza a tabela de administradores. */
async function carregarAdministradores() {
  try {
    const administradores = await buscarAdministradores();
    renderizarAdministradores(administradores);
    return administradores;
  } catch (error) {
    console.error("Erro ao listar administradores:", error);
    notificar(mensagemErro(error, "Erro ao carregar os administradores."), "erro");
    return [];
  }
}

/**
 * Abre a modal de administrador para criação (sem id) ou edição
 * (com id + objeto admin para pré-preencher). Em edição, a senha é
 * opcional; em criação, é obrigatória.
 */
function abrirModalAdmin(id = null, admin = null) {
  if (!elementos.dialogNovoAdmin) return;

  adminEditandoId = id;

  if (elementos.nomeAdmin) elementos.nomeAdmin.value = admin?.nome || "";
  if (elementos.emailAdmin) elementos.emailAdmin.value = admin?.email || "";
  if (elementos.senhaAdmin) {
    elementos.senhaAdmin.value = "";
    elementos.senhaAdmin.required = !id;
  }

  const confirmarSenha = document.getElementById("confirmarSenha");
  if (confirmarSenha) confirmarSenha.value = "";

  const titulo = elementos.dialogNovoAdmin.querySelector("h3");
  if (titulo) titulo.textContent = id ? "Editar administrador" : "Adicionar novo administrador";

  elementos.dialogNovoAdmin.showModal();
}

/**
 * Submit da modal de administrador: valida nome/e-mail (e senha >= 8
 * na criação, conferência de confirmação) e chama POST/PUT conforme
 * esteja criando ou editando.
 */
async function enviarAdmin(event) {
  event.preventDefault();

  const nome = elementos.nomeAdmin?.value.trim();
  const email = elementos.emailAdmin?.value.trim();
  const senha = elementos.senhaAdmin?.value;
  const confirmarSenha = document.getElementById("confirmarSenha")?.value;

  if (!nome || !email) {
    notificar("Preencha o nome e o e-mail do administrador.", "aviso");
    return;
  }

  if (!adminEditandoId && (!senha || senha.length < 8)) {
    notificar("A senha deve ter pelo menos 8 caracteres.", "aviso");
    return;
  }

  if (senha && senha !== confirmarSenha) {
    notificar("As senhas não conferem.", "aviso");
    return;
  }

  const botao = elementos.btnCadastrarAdmin;
  if (botao) botao.disabled = true;

  try {
    if (adminEditandoId) {
      await atualizarAdministrador(adminEditandoId, {
        nome,
        email,
        ...(senha ? { senha } : {}),
      });
      notificar("Administrador atualizado com sucesso!", "sucesso");
    } else {
      await cadastrarAdministrador({ nome, email, senha });
      notificar("Administrador cadastrado com sucesso!", "sucesso");
    }

    elementos.formAdmin?.reset();
    elementos.dialogNovoAdmin?.close();
    adminEditandoId = null;

    await carregarAdministradores();
  } catch (error) {
    console.error("Erro ao salvar administrador:", error);
    notificar(mensagemErro(error, "Erro ao salvar o administrador."), "erro");
  } finally {
    if (botao) botao.disabled = false;
  }
}

/** DELETE do administrador após confirmação em modal. */
async function removerAdministradorSelecionado(id) {
  if (!(await confirmar("Deseja realmente remover este administrador?", "Remover administrador"))) return;

  try {
    await removerAdministrador(id);
    notificar("Administrador removido com sucesso!", "sucesso");
    await carregarAdministradores();
  } catch (error) {
    console.error("Erro ao remover administrador:", error);
    notificar(mensagemErro(error, "Erro ao remover o administrador."), "erro");
  }
}

/** Busca os administradores e abre a modal de edição do id informado. */
async function editarAdministradorSelecionado(id) {
  try {
    const administradores = await buscarAdministradores();
    const admin = administradores.find((item) => String(item.id) === String(id));
    abrirModalAdmin(id, admin);
  } catch (error) {
    console.error("Erro ao carregar administrador:", error);
    notificar(mensagemErro(error, "Erro ao carregar o administrador."), "erro");
  }
}

let profissionaisPorId = {};

/* =========================
   Profissionais
   ========================= */

/**
 * Renderiza a tabela de profissionais e popula o <select> do formulário
 * de evento (mantendo a seleção atual quando o profissional continua
 * existindo). Também alimenta o mapa profissionaisPorId.
 */
function renderizarProfissionais(profissionais) {
  profissionaisPorId = Object.fromEntries(
    profissionais.map((profissional) => [profissional.id, profissional.nome]),
  );

  if (elementos.tabelaProfissionais) {
    elementos.tabelaProfissionais.innerHTML =
      profissionais.length > 0
        ? profissionais
            .map(
              (profissional) => `
                <tr class="body-table">
                  <td>${escapeHTML(profissional.id)}</td>
                  <td>${escapeHTML(profissional.nome)}</td>
                  <td>${escapeHTML(profissional.profissao)}</td>
                  <td>
                    <button
                      type="button"
                      class="btn-remover"
                      data-remover-profissional="${escapeHTML(profissional.id)}"
                      title="Remover profissional"
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              `,
            )
            .join("")
        : `<tr><td colspan="4" class="tabela-vazia">Nenhum profissional cadastrado.</td></tr>`;
  }

  if (elementos.selectProfissional) {
    const valorAtual = elementos.selectProfissional.value;

    elementos.selectProfissional.innerHTML = [
      '<option value="" disabled selected>Selecione um profissional</option>',
      ...profissionais.map(
        (profissional) =>
          `<option value="${escapeHTML(profissional.id)}">${escapeHTML(profissional.nome)}</option>`,
      ),
    ].join("");

    const aindaExiste = profissionais.some(
      (profissional) => String(profissional.id) === String(valorAtual),
    );

    if (aindaExiste) elementos.selectProfissional.value = valorAtual;
  }
}

/** GET /profissionais/buscar → tabela + select + profissionaisPorId. */
async function carregarProfissionais() {
  console.log("carregarProfissionais start");
  try {
    const profissionais = await buscarProfissionais();
    console.log("carregarProfissionais fetched", profissionais.length);
    renderizarProfissionais(profissionais);
    profissionaisPorId = Object.fromEntries(profissionais.map((profissional) => [profissional.id, profissional.nome]));
    return profissionais;
  } catch (error) {
    console.error("Erro ao listar profissionais:", error);
    notificar(mensagemErro(error, "Erro ao carregar os profissionais."), "erro");
    return [];
  }
}

/**
 * Submit da modal de profissional: valida nome/profissão e chama
 * POST /profissionais, atualizando a tabela em seguida.
 */
async function enviarProfissional(event) {
  event.preventDefault();

  const nome = elementos.inputNomeProfissional?.value.trim();
  const profissao = elementos.inputProfissao?.value.trim();

  if (!nome || !profissao) {
    notificar("Preencha o nome e a profissão do profissional.", "aviso");
    return;
  }

  const botao = elementos.formProfissional?.querySelector('button[type="submit"]');
  if (botao) botao.disabled = true;

  try {
    await cadastrarProfissional({ nome, profissao });

    elementos.formProfissional?.reset();
    elementos.modalProfissional?.close();

    notificar("Profissional cadastrado com sucesso!", "sucesso");
    await carregarProfissionais();
  } catch (error) {
    console.error("Erro ao cadastrar profissional:", error);
    notificar(mensagemErro(error, "Erro ao cadastrar o profissional."), "erro");
  } finally {
    if (botao) botao.disabled = false;
  }
}

/** DELETE /profissionais/deletar/:id após confirmação em modal. */
async function removerProfissionalSelecionado(id) {
  if (!(await confirmar("Deseja realmente remover este profissional?", "Remover profissional"))) return;

  try {
    await removerProfissional(id);
    notificar("Profissional removido com sucesso!", "sucesso");
    await carregarProfissionais();
  } catch (error) {
    console.error("Erro ao remover profissional:", error);
    notificar(mensagemErro(error, "Erro ao remover o profissional."), "erro");
  }
}

/* =========================
   Eventos / sessões
   ========================= */

/**
 * Submit da modal de evento: valida os campos, chama POST /sessoes e,
 * em sucesso, fecha a modal e recarrega calendário e painel de eventos.
 */
async function enviarEvento(event) {
  event.preventDefault();

  const nome = elementos.inputNomeEvento?.value.trim();
  const dia = elementos.inputDataEvento?.value;
  const horario = elementos.inputHorarioEvento?.value;
  const modalidade = elementos.inputModalidade?.value.trim();
  const profissionalId = elementos.selectProfissional?.value;
  const vagas = Number(elementos.inputVagas?.value);

  if (!nome || !dia || !horario || !modalidade || !profissionalId || !elementos.inputVagas?.value) {
    notificar("Preencha todos os campos do evento.", "aviso");
    return;
  }

  if (!Number.isInteger(vagas) || vagas < 0) {
    notificar("As vagas devem ser um número inteiro maior ou igual a zero.", "aviso");
    return;
  }

  const botao = elementos.formEvento?.querySelector("button");
  if (botao) botao.disabled = true;

  try {
    await cadastrarSessao({
      nome,
      dia,
      horario,
      modalidade,
      profissional_id: profissionalId,
      vagas,
    });

    elementos.formEvento?.reset();
    elementos.modalEvento?.close();

    notificar("Evento cadastrado com sucesso!", "sucesso");
    recarregarCalendarioAdmin();
    atualizarPainelEventos();
  } catch (error) {
    console.error("Erro ao cadastrar evento:", error);
    notificar(mensagemErro(error, "Erro ao cadastrar o evento."), "erro");
  } finally {
    if (botao) botao.disabled = false;
  }
}

/** Linha de participante na tabela de detalhes da sessão. */
function linhaParticipante(participante, indice) {
  return `
    <tr>
      <td>${indice + 1}</td>
      <td>${escapeHTML(participante.nome)}</td>
      <td>${escapeHTML(participante.setor ?? "—")}</td>
      <td>
        <button
          type="button"
          class="btn-remover"
          data-remover-participante="${escapeHTML(participante.id)}"
        >
          Remover
        </button>
      </td>
    </tr>
  `;
}

/** Linha de sessão na tabela do resumo do dia (modal de detalhes). */
function linhaResumoSessao(sessao, inscritos) {
  const vagas = Number(sessao.vagas) || 0;
  const profissional =
    profissionaisPorId[sessao.profissional_id] || "Profissional não encontrado";

  return `
    <tr>
      <td>${escapeHTML(formatarHorario(sessao.data?.horario))}</td>
      <td>${escapeHTML(sessao.nome)}</td>
      <td>${escapeHTML(sessao.modalidade)}</td>
      <td>${escapeHTML(profissional)}</td>
      <td>${vagas} / ${inscritos}</td>
      <td>
        <button
          type="button"
          class="btn-secundario btn-compacto"
          data-ver-sessao="${escapeHTML(sessao.id)}"
        >
          Ver detalhes
        </button>
      </td>
    </tr>
  `;
}

/**
 * Abre a modal de resumo do dia: tabela com as sessões do dia
 * (horário, modalidade, profissional, vagas/inscritos, ações) e botão
 * para adicionar evento já com o dia pré-preenchido.
 */
async function abrirResumoDia(dia) {
  if (!elementos.modalDetalhes) return;

  try {
    if (Object.keys(profissionaisPorId).length === 0) {
      await carregarProfissionais();
    }

    const [sessoes, participantes] = await Promise.all([
      buscarSessoes(),
      buscarParticipantes(),
    ]);

    const sessoesDoDia = sessoes
      .filter((sessao) => String(sessao.data?.dia ?? "").slice(0, 10) === dia)
      .sort((a, b) =>
        String(a.data?.horario ?? "").localeCompare(String(b.data?.horario ?? "")),
      );

    const inscritosPorSessao = participantes.reduce((acumulado, participante) => {
      const chave = String(participante.sessao_id);
      acumulado[chave] = (acumulado[chave] || 0) + 1;
      return acumulado;
    }, {});

    elementos.modalDetalhes.innerHTML = `
      <div class="detalhes-topo">
        <div>
          <h3>Sessões do dia</h3>
          <p>${escapeHTML(formatarDataLonga(dia))}</p>
        </div>
        <button type="button" class="fechar-dialog" data-fechar-dialog aria-label="Fechar">×</button>
      </div>

      ${
        sessoesDoDia.length > 0
          ? `
            <div class="resumo-dia-tabela detalhes-tabela">
              <table>
                <thead>
                  <tr>
                    <th>Horário</th>
                    <th>Sessão</th>
                    <th>Modalidade</th>
                    <th>Profissional</th>
                    <th>Vagas / Inscritos</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${sessoesDoDia
                    .map((sessao) =>
                      linhaResumoSessao(sessao, inscritosPorSessao[String(sessao.id)] || 0),
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `
          : `<p class="resumo-dia-vazio">Nenhuma sessão cadastrada neste dia.</p>`
      }

      <div class="resumo-dia-acoes">
        <button type="button" class="btn-principal" data-adicionar-no-dia="${escapeHTML(dia)}">
          + Adicionar evento neste dia
        </button>
        <button type="button" class="btn-secundario" data-fechar-dialog>Fechar</button>
      </div>
    `;

    if (!elementos.modalDetalhes.open) elementos.modalDetalhes.showModal();
  } catch (error) {
    console.error("Erro ao abrir o resumo do dia:", error);
    notificar(mensagemErro(error, "Erro ao carregar as sessões do dia."), "erro");
  }
}

/** Dia atualmente escolhido no calendário (null = mostrando próximos). */
let diaSelecionado = null;

/** Agrupa os participantes por sessao_id em contagens de inscritos. */
function contarInscritosPorSessao(participantes) {
  return (Array.isArray(participantes) ? participantes : []).reduce((acumulado, participante) => {
    const chave = String(participante.sessao_id);
    acumulado[chave] = (acumulado[chave] || 0) + 1;
    return acumulado;
  }, {});
}

/** HTML do card de evento usado no painel lateral. */
function cartaoEvento(sessao, inscritos) {
  const profissional =
    profissionaisPorId[sessao.profissional_id] || "Profissional não encontrado";
  const vagas = Number(sessao.vagas) || 0;

  return `
    <article class="evento-dia-card">
      <div class="evento-dia-topo">
        <h3>${escapeHTML(sessao.nome)}</h3>
        <span class="evento-dia-horario">${escapeHTML(formatarHorario(sessao.data?.horario))}</span>
      </div>
      <div class="evento-dia-info">
        <span><strong>Modalidade:</strong> ${escapeHTML(sessao.modalidade)}</span>
        <span><strong>Profissional:</strong> ${escapeHTML(profissional)}</span>
        <span><strong>Vagas restantes:</strong> ${vagas}</span>
        <span><strong>Inscritos:</strong> ${inscritos}</span>
        <span><strong>Data:</strong> ${escapeHTML(formatarDataLonga(sessao.data?.dia))}</span>
      </div>
      <div class="evento-dia-acoes">
        <button type="button" class="btn-secundario btn-compacto" data-ver-sessao="${escapeHTML(sessao.id)}">
          Ver detalhes
        </button>
      </div>
    </article>
  `;
}

/**
 * Busca sessões, participantes e profissionais em paralelo e devolve
 * a lista de sessões + mapa de inscritos por sessão (atualizando
 * profissionaisPorId para exibir os nomes).
 */
async function carregarDadosEventos() {
  const [sessoes, participantes, profissionais] = await Promise.all([
    buscarSessoes(),
    buscarParticipantes(),
    buscarProfissionais(),
  ]);

  profissionaisPorId = Object.fromEntries(
    (Array.isArray(profissionais) ? profissionais : []).map((profissional) => [
      profissional.id,
      profissional.nome,
    ]),
  );

  return {
    sessoes: Array.isArray(sessoes) ? sessoes : [],
    inscritosPorSessao: contarInscritosPorSessao(participantes),
  };
}

/**
 * Renderiza no painel lateral os eventos do dia clicado no calendário
 * (ordenados por horário), com carregamento e tratamento de erro.
 */
async function renderizarEventosDoDia(dia) {
  const container = elementos.listaEventosDia;
  const label = elementos.dataEventosSelecionados;

  if (!container) return;

  if (label) label.textContent = formatarDataLonga(dia);
  container.innerHTML = `<p class="tabela-vazia">Carregando eventos...</p>`;

  try {
    const { sessoes, inscritosPorSessao } = await carregarDadosEventos();

    const sessoesDoDia = sessoes
      .filter((sessao) => String(sessao.data?.dia ?? "").slice(0, 10) === dia)
      .sort((a, b) =>
        String(a.data?.horario ?? "").localeCompare(String(b.data?.horario ?? "")),
      );

    if (sessoesDoDia.length === 0) {
      container.innerHTML = `<p class="resumo-dia-vazio">Nenhum evento selecionado para este dia.</p>`;
      return;
    }

    container.innerHTML = sessoesDoDia
      .map((sessao) => cartaoEvento(sessao, inscritosPorSessao[String(sessao.id)] || 0))
      .join("");
  } catch (error) {
    console.error("Erro ao carregar os eventos do dia:", error);
    container.innerHTML = `<p class="resumo-dia-vazio">${escapeHTML(
      mensagemErro(error, "Erro ao carregar os eventos do dia."),
    )}</p>`;
  }
}

/**
 * Estado inicial do painel lateral: os 3 eventos mais próximos da data
 * atual (dia de hoje em diante, ordenados por data/horário). Limpa o
 * dia selecionado — usado ao abrir a página e quando não há dia ativo.
 */
async function carregarProximosEventos() {
  const container = elementos.listaEventosDia;
  const label = elementos.dataEventosSelecionados;

  if (!container) return;

  diaSelecionado = null;

  if (label) label.textContent = "Próximos eventos";
  container.innerHTML = `<p class="tabela-vazia">Carregando eventos...</p>`;

  try {
    const { sessoes, inscritosPorSessao } = await carregarDadosEventos();
    const hoje = hojeISO();

    const proximosEventos = sessoes
      .filter((sessao) => String(sessao.data?.dia ?? "").slice(0, 10) >= hoje)
      .sort(
        (a, b) =>
          String(a.data?.dia ?? "").slice(0, 10).localeCompare(String(b.data?.dia ?? "").slice(0, 10)) ||
          String(a.data?.horario ?? "").localeCompare(String(b.data?.horario ?? "")),
      )
      .slice(0, 3);

    if (proximosEventos.length === 0) {
      container.innerHTML = `<p class="resumo-dia-vazio">Nenhum evento próximo encontrado.</p>`;
      return;
    }

    container.innerHTML = proximosEventos
      .map((sessao) => cartaoEvento(sessao, inscritosPorSessao[String(sessao.id)] || 0))
      .join("");
  } catch (error) {
    console.error("Erro ao carregar os próximos eventos:", error);
    container.innerHTML = `<p class="resumo-dia-vazio">${escapeHTML(
      mensagemErro(error, "Erro ao carregar os próximos eventos."),
    )}</p>`;
  }
}

/**
 * Atualiza o painel lateral após qualquer mutação (criar/excluir evento,
 * remover participante): mantém o dia selecionado se houver, senão volta
 * a exibir os 3 eventos mais próximos.
 */
function atualizarPainelEventos() {
  if (diaSelecionado) renderizarEventosDoDia(diaSelecionado);
  else carregarProximosEventos();
}

/**
 * Abre a modal de detalhes da sessão: dados completos + tabela de
 * participantes inscritos + ações (excluir evento, remover participante).
 */
async function abrirDetalhesSessao(id) {
  if (!elementos.modalDetalhes) return;

  try {
    if (Object.keys(profissionaisPorId).length === 0) {
      await carregarProfissionais();
    }

    const [sessoes, participantes] = await Promise.all([
      buscarSessoes(),
      buscarParticipantes(id),
    ]);

    const sessao = sessoes.find((item) => String(item.id) === String(id));

    if (!sessao) {
      notificar("Sessão não encontrada. Atualize o calendário.", "erro");
      recarregarCalendarioAdmin();
      return;
    }

    const profissional =
      profissionaisPorId[sessao.profissional_id] || "Profissional não encontrado";
    const vagas = Number(sessao.vagas) || 0;

    elementos.modalDetalhes.innerHTML = `
      <div class="detalhes-topo">
        <div>
          <h3>${escapeHTML(sessao.nome)}</h3>
          <p>${escapeHTML(formatarDataLonga(sessao.data.dia))} às ${escapeHTML(formatarHorario(sessao.data.horario))}</p>
        </div>
        <button type="button" class="fechar-dialog" data-fechar-dialog aria-label="Fechar">×</button>
      </div>

      <div class="detalhes-info">
        <span><strong>Modalidade:</strong> ${escapeHTML(sessao.modalidade)}</span>
        <span><strong>Profissional:</strong> ${escapeHTML(profissional)}</span>
        <span><strong>Vagas restantes:</strong> ${vagas}</span>
        <span><strong>Inscritos:</strong> ${participantes.length}</span>
      </div>

      <div class="detalhes-tabela">
        <h4>Participantes</h4>
        <table>
          <thead>
            <tr>
              <th>Nº</th>
              <th>Nome</th>
              <th>Setor</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${
              participantes.length > 0
                ? participantes.map(linhaParticipante).join("")
                : `<tr><td colspan="4" class="tabela-vazia">Nenhum participante inscrito.</td></tr>`
            }
          </tbody>
        </table>
      </div>

      <div class="detalhes-acoes">
        <button type="button" class="btn-perigo" data-excluir-evento="${escapeHTML(sessao.id)}">
          Excluir evento
        </button>
        <button type="button" class="btn-secundario" data-fechar-dialog>Fechar</button>
      </div>
    `;

    if (!elementos.modalDetalhes.open) elementos.modalDetalhes.showModal();
  } catch (error) {
    console.error("Erro ao abrir os detalhes da sessão:", error);
    notificar(mensagemErro(error, "Erro ao carregar os detalhes da sessão."), "erro");
  }
}

/** DELETE /sessoes/delete/:id após confirmação (remove em cascata). */
async function excluirEvento(id) {
  if (!(await confirmar("Excluir este evento também remove todos os participantes inscritos. Continuar?", "Excluir evento", "Excluir"))) {
    return;
  }

  try {
    await removerSessao(id);
    elementos.modalDetalhes?.close();
    notificar("Evento excluído com sucesso!", "sucesso");
    recarregarCalendarioAdmin();
    atualizarPainelEventos();
  } catch (error) {
    console.error("Erro ao excluir evento:", error);
    notificar(mensagemErro(error, "Erro ao excluir o evento."), "erro");
  }
}

/**
 * Remove um participante da sessão e reabre os detalhes atualizados
 * (a vaga volta a ficar disponível).
 */
async function excluirParticipante(id, sessaoId) {
  if (!(await confirmar("Deseja remover este participante da sessão?", "Remover participante"))) return;

  try {
    await removerParticipante(id);
    notificar("Participante removido com sucesso!", "sucesso");
    recarregarCalendarioAdmin();
    atualizarPainelEventos();
    await abrirDetalhesSessao(sessaoId);
  } catch (error) {
    console.error("Erro ao remover participante:", error);
    notificar(mensagemErro(error, "Erro ao remover o participante."), "erro");
  }
}

/* =========================
   Modais
   ========================= */

/**
 * Abre a modal de cadastro de evento, opcionalmente pré-preenchendo o
 * dia (fluxo "adicionar evento neste dia" no resumo do dia).
 */
function abrirModalEvento(dia = "") {
  if (!elementos.modalEvento) return;

  if (dia && elementos.inputDataEvento) elementos.inputDataEvento.value = dia;
  elementos.modalEvento.showModal();
}

/**
 * Registra os listeners globais dos modais:
 * - botões da navegação lateral (novo evento/profissional);
 * - fechar dialogs clicando fora ou nos botões [data-fechar-dialog];
 * - reset do formulário de admin ao fechar a modal.
 */
function configurarModais() {
  elementos.botaoNovoEvento?.addEventListener("click", () => abrirModalEvento());
  elementos.botaoNovoProfissional?.addEventListener("click", () =>
    elementos.modalProfissional?.showModal(),
  );

  [elementos.modalEvento, elementos.modalProfissional, elementos.modalDetalhes, elementos.dialogNovoAdmin].forEach(
    (dialog) => {
      dialog?.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
    },
  );

  elementos.dialogNovoAdmin?.addEventListener("close", () => {
    adminEditandoId = null;
    elementos.formAdmin?.reset();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("[data-fechar-dialog]")) return;

    const dialog = event.target.closest("dialog");
    dialog?.close();
  });
}

/* =========================
   Delegação de eventos
   ========================= */

// Calendário → dia clicado: passa a exibir os eventos daquele dia.
document.addEventListener("diaAdminSelecionado", (event) => {
  console.log("diaAdminSelecionado", event.detail?.dia);
  const dia = event.detail?.dia;
  if (dia) {
    diaSelecionado = dia;
    renderizarEventosDoDia(dia);
  }
});

/* debug removed */
window.__carregarProfissionais = carregarProfissionais;

document.addEventListener("sessaoAdminSelecionada", (event) => {
  if (event.detail?.id) abrirDetalhesSessao(event.detail.id);
});

elementos.tabelaProfissionais?.addEventListener("click", (event) => {
  const botao = event.target.closest("[data-remover-profissional]");
  if (botao) removerProfissionalSelecionado(botao.dataset.removerProfissional);
});

elementos.tabelaAdministradores?.addEventListener("click", (event) => {
  const botaoEditar = event.target.closest("[data-editar-admin]");
  if (botaoEditar) {
    editarAdministradorSelecionado(botaoEditar.dataset.editarAdmin);
    return;
  }

  const botaoRemover = event.target.closest("[data-remover-admin]");
  if (botaoRemover) {
    removerAdministradorSelecionado(botaoRemover.dataset.removerAdmin);
  }
});

elementos.modalDetalhes?.addEventListener("click", (event) => {
  const botaoVerSessao = event.target.closest("[data-ver-sessao]");
  if (botaoVerSessao) {
    abrirDetalhesSessao(botaoVerSessao.dataset.verSessao);
    return;
  }

  const botaoAdicionarNoDia = event.target.closest("[data-adicionar-no-dia]");
  if (botaoAdicionarNoDia) {
    const dia = botaoAdicionarNoDia.dataset.adicionarNoDia;
    elementos.modalDetalhes.close();
    abrirModalEvento(dia);
    return;
  }

  const botaoExcluirEvento = event.target.closest("[data-excluir-evento]");
  if (botaoExcluirEvento) {
    excluirEvento(botaoExcluirEvento.dataset.excluirEvento);
    return;
  }

  const botaoParticipante = event.target.closest("[data-remover-participante]");
  if (!botaoParticipante) return;

  const excluir = elementos.modalDetalhes.querySelector("[data-excluir-evento]");
  const sessaoId = excluir?.dataset.excluirEvento;

  if (sessaoId) {
    excluirParticipante(
      botaoParticipante.dataset.removerParticipante,
      sessaoId,
    );
  }
});

elementos.formProfissional?.addEventListener("submit", enviarProfissional);
elementos.formEvento?.addEventListener("submit", enviarEvento);
elementos.formAdmin?.addEventListener("submit", enviarAdmin);

elementos.adicionarAdministrador?.addEventListener("click", (event) => {
  event.preventDefault();
  abrirModalAdmin();
});

/**
 * Guarda de rota da página: valida o token salvo contra GET /auth/me;
 * se inválido, limpa a sessão e volta ao login. Também exibe o e-mail
 * no rodapé lateral e conecta o botão "Sair da conta".
 */
async function inicializarAutenticacao() {
  let usuario = obterUsuarioAutenticado();

  try {
    const atual = await buscarUsuarioAtual();
    if (atual) usuario = atual;
  } catch (error) {
    console.error("Sessão inválida:", error);
    limparSessaoAutenticada();
    window.location.replace("./login.html");
    return;
  }

  const emailEl = document.getElementById("email");
  if (emailEl && usuario?.email) {
    emailEl.textContent = usuario.email;
    emailEl.title = usuario.email;
  }

  document.querySelector(".sair")?.addEventListener("click", () => {
    limparSessaoAutenticada();
    window.location.replace("./login.html");
  });
}

elementos.listaEventosDia?.addEventListener("click", (event) => {
  const botaoVerSessao = event.target.closest("[data-ver-sessao]");
  if (botaoVerSessao) abrirDetalhesSessao(botaoVerSessao.dataset.verSessao);
});

/* =========================
   Inicialização
   ========================= */

if (!estaAutenticado()) {
  window.location.replace("./login.html");
} else {
  configurarModais();
  inicializarAutenticacao();
  carregarProximosEventos();
}
