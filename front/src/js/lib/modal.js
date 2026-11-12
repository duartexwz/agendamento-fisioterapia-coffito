/**
 * Modais reutilizáveis para substituir alert/confirm do navegador.
 * Funciona com o elemento <dialog> nativo.
 *
 * O mesmo dialog singleton é reaproveitado em toda a aplicação;
 * `mostrarModal` devolve uma Promise resolvida com o valor do botão
 * clicado (true/false) ou false quando o dialog é fechado sem escolher.
 */

let dialogAtual = null;

/** Cria o dialog base com título, mensagem e área de botões. */
function criarDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "app-modal";
  dialog.innerHTML = `
    <div class="app-modal-conteudo">
      <div class="app-modal-topo">
        <h3 class="app-modal-titulo"></h3>
      </div>
      <p class="app-modal-mensagem"></p>
      <div class="app-modal-acoes"></div>
    </div>
  `;
  document.body.appendChild(dialog);
  return dialog;
}

/** Reaproveita o dialog existente ou cria um novo (se removido do DOM). */
function obterDialog() {
  if (!dialogAtual || !document.body.contains(dialogAtual)) {
    dialogAtual = criarDialog();
  }
  return dialogAtual;
}

/**
 * Abre a modal genérica.
 *
 * @param {object} [opcoes]
 * @param {string} [opcoes.titulo]  Título exibido no topo.
 * @param {string} [opcoes.mensagem] Corpo da mensagem.
 * @param {string} [opcoes.tipo]     info | erro | aviso | confirmacao.
 * @param {Array<{texto: string, valor: any, classe?: string}>} [opcoes.botoes]
 * @returns {Promise<any>} Valor do botão clicado (false se fechado direto).
 */
export function mostrarModal({
  titulo = "Aviso",
  mensagem = "",
  tipo = "info",
  botoes = [{ texto: "OK", valor: true, classe: "btn-principal" }],
} = {}) {
  const dialog = obterDialog();
  const tituloEl = dialog.querySelector(".app-modal-titulo");
  const mensagemEl = dialog.querySelector(".app-modal-mensagem");
  const acoesEl = dialog.querySelector(".app-modal-acoes");
  const btnFechar = dialog.querySelector('.app-modal-topo-button');

  tituloEl.textContent = titulo;
  mensagemEl.textContent = mensagem;
  dialog.dataset.tipo = tipo;

  acoesEl.innerHTML = "";
  botoes.forEach((botao) => {
    const elemento = document.createElement("button");
    elemento.type = "button";
    elemento.textContent = botao.texto;
    elemento.className = botao.classe || "btn-secundario";
    elemento.addEventListener("click", () => {
      dialog.close();
      dialog.dispatchEvent(
        new CustomEvent("modal-resposta", { detail: { valor: botao.valor } }),
      );
    });
    acoesEl.appendChild(elemento);
  });

  return new Promise((resolve) => {
    const aoFechar = (evento) => {
      if (evento.type === "modal-resposta") {
        resolve(evento.detail?.valor);
      } else {
        resolve(false);
      }
      dialog.removeEventListener("close", aoFechar);
      dialog.removeEventListener("modal-resposta", aoFechar);
    };

    dialog.addEventListener("close", aoFechar);
    dialog.addEventListener("modal-resposta", aoFechar);

    if (!dialog.open) dialog.showModal();
  });
}

/** Atalho para modais de erro com botão "OK" destacado. */
export function mostrarErro(mensagem, titulo = "Erro") {
  return mostrarModal({
    titulo,
    mensagem,
    tipo: "erro",
    botoes: [{ texto: "OK", valor: true, classe: "btn-perigo" }],
  });
}

/** Atalho para modais de aviso com botão "OK". */
export function mostrarAviso(mensagem, titulo = "Aviso") {
  return mostrarModal({
    titulo,
    mensagem,
    tipo: "aviso",
    botoes: [{ texto: "OK", valor: true, classe: "btn-principal" }],
  });
}

/**
 * Substituto do confirm(): modal com Cancelar/Confirmar.
 * @returns {Promise<boolean>} true apenas no botão de confirmação.
 */
export function confirmar(mensagem, titulo = "Confirmação", textoConfirmar = "Confirmar") {
  return mostrarModal({
    titulo,
    mensagem,
    tipo: "confirmacao",
    botoes: [
      { texto: "Cancelar", valor: false, classe: "btn-secundario" },
      { texto: textoConfirmar, valor: true, classe: "btn-perigo" },
    ],
  });
}