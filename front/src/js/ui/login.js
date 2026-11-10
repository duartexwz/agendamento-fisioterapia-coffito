/**
 * Controller da tela de login (login.html).
 *
 * - Redireciona para o painel quem já possui sessão salva.
 * - Alterna a visibilidade da senha (botão mostrar/ocultar).
 * - Submete o formulário chamando POST /auth/login; em caso de sucesso
 *   o token fica salvo (lib/app.js) e o usuário é levado ao admin.
 */
import { fazerLogin, estaAutenticado } from "../lib/app.js";
import { mostrarErro } from "../lib/modal.js";

/* Redireciona quem já está autenticado. */
if (estaAutenticado()) {
  window.location.replace("./admin.html");
}

// Elementos da tela.
const elementos = {
  form: document.getElementById("formLogin"),
  email: document.getElementById("emailLogin"),
  senha: document.getElementById("senhaLogin"),
  botaoEntrar: document.getElementById("botaoEntrar"),
  botaoVerSenha: document.getElementById("botaoVerSenha"),
};

// Alterna o campo de senha entre texto puro e mascarado.
elementos.botaoVerSenha?.addEventListener("click", () => {
  const visivel = elementos.senha.type === "text";
  elementos.senha.type = visivel ? "password" : "text";
  elementos.botaoVerSenha.textContent = visivel ? "Mostrar" : "Ocultar";
});

// Envio do login: valida campos, chama a API e redireciona.
elementos.form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = elementos.email?.value.trim();
  const senha = elementos.senha?.value;

  if (!email || !senha) {
    await mostrarErro("Preencha o e-mail e a senha para continuar.", "Campos obrigatórios");
    return;
  }

  if (elementos.botaoEntrar) elementos.botaoEntrar.disabled = true;

  try {
    await fazerLogin({ email, senha });
    window.location.replace("./admin.html");
  } catch (error) {
    console.error("Erro ao realizar login:", error);
    await mostrarErro(
      error?.response?.data?.message || "Não foi possível entrar. Verifique suas credenciais.",
      "Falha no login",
    );
  } finally {
    if (elementos.botaoEntrar) elementos.botaoEntrar.disabled = false;
  }
});