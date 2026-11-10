/**
 * Controller da página de cadastros (cadastros.html).
 *
 * Reúne o gerenciamento das tabelas de profissionais e administradores:
 * - listagem ao carregar a página (GET profissionais / administradores);
 * - cadastro/edição/remoção via modais e delegação de eventos;
 * - modal de cadastro de evento/sessão (mesma do admin.html), com o
 *   <select> de profissionais alimentado pela listagem.
 *
 * Diferente do admin.html, não há calendário — apenas os formulários.
 */
import {
  buscarProfissionais,
  cadastrarProfissional,
  cadastrarSessao,
  removerProfissional,
  mensagemErro,
  buscarUsuarioAtual,
  estaAutenticado,
  limparSessaoAutenticada,
  obterUsuarioAutenticado,
  buscarAdministradores,
  cadastrarAdministrador,
  atualizarAdministrador,
  removerAdministrador,
} from "../lib/app.js";
import { escapeHTML, notificar } from "../lib/utils.js";
import { confirmar } from "../lib/modal.js";

const elementos = {
  botaoNovoEvento: document.getElementById("novoEvento"),
  botaoNovoProfissional: document.getElementById("novoProfissional"),
  tabelaProfissionais: document.getElementById("corpoTable"),
  inputNomeProfissional: document.getElementById("nomeProfissional"),
  inputProfissao: document.getElementById("profissaoProfissional"),
  formProfissional: document.getElementById("formProfissionais"),
  modalProfissional: document.querySelector(".adicionar-profissional"),
  tabelaAdministradores: document.getElementById("corpoAdministradores"),
  dialogNovoAdmin: document.getElementById("novoAdmin"),
  formAdmin: document.getElementById("cadastroAdmin"),
  nomeAdmin: document.getElementById("inputNomeAdmin"),
  emailAdmin: document.getElementById("inputEmailAdmin"),
  senhaAdmin: document.getElementById("inputSenhaAdmin"),
  btnCadastrarAdmin: document.getElementById("btnCadastrarAdmin"),
  modalEvento: document.querySelector(".evento-dialog"),
  formEvento: document.getElementById("cadastroEvento"),
  inputNomeEvento: document.getElementById("nomeEvento"),
  inputDataEvento: document.getElementById("dateEvent"),
  inputHorarioEvento: document.getElementById("horarioSessao"),
  inputVagas: document.getElementById("vagasSessao"),
  inputModalidade: document.getElementById("modalidadeSessao"),
  selectProfissional: document.getElementById("selectProfissional"),
};

let profissionaisPorId = {};
let adminEditandoId = null;

/**
 * Renderiza a tabela de profissionais e popula o <select> do
 * formulário de evento (mantendo a seleção atual quando possível).
 */
function renderizarProfissionais(profissionais) {
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
                    <button type="button" class="btn-remover" data-remover-profissional="${escapeHTML(profissional.id)}">
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

/** GET /profissionais/buscar → tabela + mapa profissionaisPorId. */
async function carregarProfissionais() {
  try {
    const profissionais = await buscarProfissionais();
    renderizarProfissionais(profissionais);
    profissionaisPorId = Object.fromEntries(profissionais.map((p) => [p.id, p.nome]));
    return profissionais;
  } catch (error) {
    console.error("Erro ao listar profissionais:", error);
    notificar(mensagemErro(error, "Erro ao carregar os profissionais."), "erro");
    return [];
  }
}

/** Submit da modal de profissional (POST /profissionais). */
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

/** Linha de administrador na tabela (Editar/Remover por delegação). */
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
                <td class="acoes">
                  <button type="button" class="btn-secundario btn-compacto" data-editar-admin="${escapeHTML(admin.id)}">Editar</button>
                  <button type="button" class="btn-remover" data-remover-admin="${escapeHTML(admin.id)}">Remover</button>
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
 * Submit da modal de evento: valida os campos e chama POST /sessoes,
 * recarregando a lista de profissionais em seguida (o novo evento pode
 * referenciar qualquer um deles).
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
    await carregarProfissionais();
  } catch (error) {
    console.error("Erro ao cadastrar evento:", error);
    notificar(mensagemErro(error, "Erro ao cadastrar o evento."), "erro");
  } finally {
    if (botao) botao.disabled = false;
  }
}


/**
 * Abre a modal de administrador para criação (sem id) ou edição
 * (com id + objeto admin para pré-preencher).
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
 * Submit da modal de administrador: valida nome/e-mail (senha >= 8 na
 * criação, senhas conferem) e chama POST ou PUT conforme o caso.
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
      await atualizarAdministrador(adminEditandoId, { nome, email, ...(senha ? { senha } : {}) });
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

/**
 * Guarda de rota da página: valida o token salvo contra GET /auth/me,
 * exibe o e-mail no rodapé lateral e conecta o botão "Sair da conta".
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

/* =========================
   Inicialização e eventos
   ========================= */

// Guarda de rota: sem token volta ao login; com token carrega as tabelas.
if (!estaAutenticado()) {
  window.location.replace("./login.html");
} else {
  inicializarAutenticacao();
  carregarProfissionais();
  carregarAdministradores();
}

// Submissão dos três formulários (profissional, evento e administrador).
elementos.formProfissional?.addEventListener("submit", enviarProfissional);
elementos.formEvento?.addEventListener("submit", enviarEvento);
elementos.formAdmin?.addEventListener("submit", enviarAdmin);

// Fecha a modal de profissional ao clicar no fundo (fora do conteúdo).
document.querySelector(".adicionar-profissional")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});

// Links da navegação lateral que abrem as modais de cadastro.
elementos.botaoNovoProfissional?.addEventListener("click", (event) => {
  event.preventDefault();
  elementos.modalProfissional?.showModal();
});

elementos.botaoNovoEvento?.addEventListener("click", (event) => {
  event.preventDefault();
  elementos.modalEvento?.showModal();
});

document.getElementById("novoAdministrador")?.addEventListener("click", (event) => {
  event.preventDefault();
  abrirModalAdmin();
});

// Delegação dos botões das tabelas (remover profissional).
elementos.tabelaProfissionais?.addEventListener("click", (event) => {
  const botao = event.target.closest("[data-remover-profissional]");
  if (botao) removerProfissionalSelecionado(botao.dataset.removerProfissional);
});

// Delegação dos botões da tabela de administradores (editar/remover).
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

// Fechamento padrão de todos os dialogs ao clicar fora do conteúdo.
document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

// Botões [data-fechar-dialog] dentro de qualquer dialog.
document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-fechar-dialog]")) return;
  const dialog = event.target.closest("dialog");
  dialog?.close();
});

// Reset do formulário e do estado de edição ao fechar a modal de admin.
elementos.dialogNovoAdmin?.addEventListener("close", () => {
  adminEditandoId = null;
  elementos.formAdmin?.reset();
});