import axios from "https://cdn.jsdelivr.net/npm/axios@1.6.7/+esm";

/**
 * Camada de acesso à API e estado compartilhado do agendamento.
 *
 * - Único ponto do front que conhece a URL da API e o axios; as demais
 *   camadas (components/ e ui/) só usam as funções exportadas aqui.
 * - Nenhuma função manipula o DOM: a renderização fica em src/js/ui.
 * - Guarda em localStorage o token (`auth_token`) e o usuário
 *   (`auth_usuario`) da sessão de administração.
 * - A base é http://localhost:3025/api/v1 em desenvolvimento local e
 *   /api/v1 (mesma origem) quando servido pelo container/nginx.
 */

/** URL base da API, escolhida conforme a origem da página. */
export const API_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3025/api/v1"
    : "/api/v1";

/** Instância do axios compartilhada (timeout de 10s por requisição). */
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Estado da sessão selecionada na página pública
let sessaoSelecionada = null;

/** Define a sessão escolhida pelo usuário na página pública. */
export function setSessaoSelecionada(sessao) {
  sessaoSelecionada = sessao;
}

/** @returns {object|null} A sessão atualmente selecionada. */
export function getSessaoSelecionada() {
  return sessaoSelecionada;
}

/** Limpa a seleção de sessão (ex.: após confirmar o agendamento). */
export function limparSessaoSelecionada() {
  sessaoSelecionada = null;
}

/** Normaliza respostas que podem vir como objeto único em vez de array. */
function comoLista(dados) {
  return Array.isArray(dados) ? dados : [];
}

/**
 * Converte erros do axios em mensagem amigável em português.
 * Prioriza mensagens vindas da API (string, data.message ou data.mensagem).
 *
 * @param {Error} error Erro capturado em um catch.
 * @param {string} [mensagemPadrao] Texto de reserva caso nada sirva.
 * @returns {string} Mensagem pronta para exibir ao usuário.
 */
export function mensagemErro(error, mensagemPadrao = "Não foi possível concluir a operação.") {
  const dados = error?.response?.data;

  if (typeof dados === "string" && dados.trim()) return dados;
  if (dados?.message) return dados.message;
  if (dados?.mensagem) return dados.mensagem;

  if (error?.code === "ECONNABORTED") {
    return "A API demorou para responder. Tente novamente.";
  }

  if (!error?.response) {
    if (error?.isAxiosError) {
      return "Não foi possível conectar à API. Verifique se o servidor está rodando em http://localhost:3025.";
    }
    return mensagemPadrao;
  }

  return mensagemPadrao;
}

/* ----------------------------- Autenticação ----------------------------- */

// Chaves usadas no localStorage para token e usuário logado.
const CHAVE_TOKEN = "auth_token";
const CHAVE_USUARIO = "auth_usuario";

// Injeta o token Bearer em toda requisição enquanto houver sessão salva.
api.interceptors.request.use((configuracao) => {
  const token = localStorage.getItem(CHAVE_TOKEN);
  if (token) {
    configuracao.headers = configuracao.headers || {};
    configuracao.headers.Authorization = `Bearer ${token}`;
  }
  return configuracao;
});

/** @returns {string|null} Token salvo na sessão atual. */
export function obterToken() {
  return localStorage.getItem(CHAVE_TOKEN);
}

/**
 * Lê o usuário salvo no localStorage (cache do último login válido).
 * @returns {object|null} { id, nome, email } ou null.
 */
export function obterUsuarioAutenticado() {
  try {
    const texto = localStorage.getItem(CHAVE_USUARIO);
    return texto ? JSON.parse(texto) : null;
  } catch (error) {
    return null;
  }
}

/** Informa se existe um token salvo (roteamento das páginas admin). */
export function estaAutenticado() {
  return Boolean(obterToken());
}

/** Persiste token e usuário após um login/cadastro bem-sucedido. */
export function salvarSessaoAutenticada({ token, usuario }) {
  if (token) localStorage.setItem(CHAVE_TOKEN, token);
  if (usuario) localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}

/** Remove token e usuário (sair da conta / sessão inválida). */
export function limparSessaoAutenticada() {
  localStorage.removeItem(CHAVE_TOKEN);
  localStorage.removeItem(CHAVE_USUARIO);
}

/**
 * POST /auth/login — autentica e salva a sessão no localStorage.
 * @returns {Promise<object|null>} Usuário logado.
 */
export async function fazerLogin({ email, senha }) {
  const { data } = await api.post("/auth/login", { email, senha });
  salvarSessaoAutenticada(data);
  return data?.usuario ?? null;
}

/**
 * POST /administrador — cadastra um novo administrador.
 * @returns {Promise<object|null>} Administrador criado.
 */
export async function cadastrarAdministrador({ nome, email, senha }) {
  const { data } = await api.post("/administrador", { nome, email, senha });
  return data?.usuario ?? null;
}

/**
 * GET /auth/me — valida o token salvo e atualiza o cache do usuário.
 * @returns {Promise<object|null>} Usuário autenticado.
 */
export async function buscarUsuarioAtual() {
  const { data } = await api.get("/auth/me");
  const usuario = data?.usuario ?? null;
  if (usuario) localStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario));
  return usuario;
}

/** GET /auth/usuarios — lista todos os administradores. */
export async function buscarAdministradores() {
  const { data } = await api.get("/auth/usuarios");
  return Array.isArray(data) ? data : [];
}

/** PUT /auth/usuarios/:id — atualiza um administrador. */
export async function atualizarAdministrador(id, dados) {
  const { data } = await api.put(`/auth/usuarios/${id}`, dados);
  return data;
}

/** DELETE /auth/usuarios/:id — remove um administrador. */
export async function removerAdministrador(id) {
  await api.delete(`/auth/usuarios/${id}`);
}

/** GET /profissionais/buscar — lista os profissionais cadastrados. */
export async function buscarProfissionais() {
  const { data } = await api.get("/profissionais/buscar");
  return comoLista(data);
}

/**
 * POST /profissionais — cadastra um profissional.
 * @returns {Promise<object|null>} Profissional criado.
 */
export async function cadastrarProfissional({ nome, profissao }) {
  const { data } = await api.post("/profissionais", { nome, profissao });
  return data?.dados ?? null;
}

/** DELETE /profissionais/deletar/:id — remove um profissional. */
export async function removerProfissional(id) {
  await api.delete(`/profissionais/deletar/${id}`);
}

/* -------------------------------- Sessões -------------------------------- */

/**
 * GET /sessoes/buscar — lista sessões (com filtros opcionais no params,
 * ex.: start/end do FullCalendar). 404 vira lista vazia.
 */
export async function buscarSessoes(params = {}) {
  try {
    const { data } = await api.get("/sessoes/buscar", { params });
    return comoLista(data);
  } catch (error) {
    // A API responde 404 quando um filtro não encontra registros.
    if (error.response?.status === 404) return [];
    throw error;
  }
}

/**
 * POST /sessoes — cadastra uma sessão/evento.
 * Monta o corpo no formato da API: { ..., data: { dia, horario } }.
 * @returns {Promise<object|null>} Sessão criada.
 */
export async function cadastrarSessao({
  nome,
  dia,
  horario,
  modalidade,
  profissional_id,
  vagas,
}) {
  const { data } = await api.post("/sessoes", {
    nome,
    data: { dia, horario },
    modalidade,
    profissional_id,
    vagas,
  });

  return data?.dados ?? null;
}

/** DELETE /sessoes/delete/:id — exclui a sessão e seus participantes. */
export async function removerSessao(id) {
  await api.delete(`/sessoes/delete/${id}`);
}

/* ----------------------------- Participantes ----------------------------- */

/**
 * GET /participantes/buscar — lista participantes (opcionalmente de uma
 * sessão, via sessaoId). 404 vira lista vazia.
 */
export async function buscarParticipantes(sessaoId) {
  try {
    const params = sessaoId != null ? { sessao_id: sessaoId } : {};
    const { data } = await api.get("/participantes/buscar", { params });
    return comoLista(data);
  } catch (error) {
    if (error.response?.status === 404) return [];
    throw error;
  }
}

/**
 * POST /participantes — inscreve um participante em uma sessão.
 * @returns {Promise<object|null>} Inscrição criada.
 */
export async function cadastrarParticipante({ nome, setor, sessao_id }) {
  const { data } = await api.post("/participantes", {
    nome,
    setor,
    sessao_id,
  });

  return data?.dados ?? null;
}

/** DELETE /participantes/deletar/:id — remove a inscrição. */
export async function removerParticipante(id) {
  await api.delete(`/participantes/deletar/${id}`);
}


/* ----------------------------- Administradores ----------------------------- */

