/**
 * Pequenos utilitários de interface usados pelas duas páginas.
 */

/**
 * Escapa caracteres HTML (&, <, >, ", ') para inserir com segurança
 * valores vindos do usuário/API em innerHTML (evita XSS).
 */
export function escapeHTML(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[caractere]);
}

/**
 * Normaliza texto para comparação: remove acentos (NFD), espaços das
 * pontas e converte para minúsculas ("Fisioterapia" == "fisioterapia").
 */
export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Exibe um toast temporário no canto da tela (container criado on-demand).
 *
 * @param {string} mensagem Texto a exibir.
 * @param {string} [tipo]    sucesso | aviso | erro (define a cor).
 */
export function notificar(mensagem, tipo = "sucesso") {
  let container = document.querySelector(".toast-container");

  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;
  toast.setAttribute("role", "status");
  toast.textContent = mensagem;
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("toast-saindo");
    window.setTimeout(() => toast.remove(), 250);
  }, 3500);
}
