/**
 * Camada de persistência compartilhada da API.
 *
 * Todo o sistema usa um único arquivo JSON como "banco de dados", com
 * quatro coleções: profissionais, sessoes, participantes_sessoes e
 * usuarios. O caminho é resolvido a partir deste arquivo, então a API
 * funciona independentemente do diretório em que o processo foi
 * iniciado. Em Docker, a variável DATA_FILE aponta para um volume
 * nomeado (docker-compose.yml), garantindo que os dados sobrevivam a
 * rebuilds; em testes, permite arquivos temporários.
 *
 * Aqui também ficam os utilitários de senha (hash scrypt) e e-mail,
 * usados pelos services de autenticação e de administradores.
 */
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'node:crypto'

// Segredo usado para assinar tokens (reservado; authServices mantém sua
// própria cópia lida da mesma variável de ambiente).
const SEGredoPadrao = 'coffito-agendamento-secret-change-me';
const SEGREDO = process.env.AUTH_SECRET || SEGredoPadrao;


/**
 * Gera o hash scrypt de uma senha, no formato `scrypt$<salt>$<hash>`.
 * O salt aleatório garante que senhas iguais produzam hashes diferentes.
 *
 * @param {string} senha Senha em texto puro.
 * @returns {string} Hash armazenável em dados.json.
 */
export function hashSenha(senha) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(senha), salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
}


/**
 * Normaliza um e-mail para comparação (sem espaços, em minúsculas).
 *
 * @param {string} email E-mail a ser normalizado.
 * @returns {string} E-mail normalizado.
 */
export function normalizarEmail(email) {
    return String(email ?? '').trim().toLowerCase();
}

// Diretório raiz do projeto da API (api-node/).
const raizApi = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Arquivo padrão de dados (api-node/dados.json). */
export const arquivoDadosPadrao = path.join(raizApi, 'dados.json');
/** Arquivo efetivamente usado; sobrescrito pela variável de ambiente DATA_FILE. */
export const arquivoDados = process.env.DATA_FILE || arquivoDadosPadrao;

/** Estrutura mínima esperada do arquivo de dados. */
function estruturaVazia() {
    return {
        profissionais: [],
        sessoes: [],
        participantes_sessoes: [],
        usuarios: [],
    };
}

/**
 * Lê e valida o arquivo de dados.
 * Qualquer coleção ausente/inválida volta como array vazio; se o arquivo
 * principal não existir, tenta o caminho padrão antes de desistir.
 *
 * @returns {Promise<{profissionais: Array, sessoes: Array, participantes_sessoes: Array, usuarios: Array}>}
 *   Dados carregados (ou estrutura vazia em caso de falha).
 */
export async function lerDados() {
    let conteudo;
    try {
        conteudo = await fs.readFile(arquivoDados, 'utf-8');
    } catch (error) {
        if (arquivoDados !== arquivoDadosPadrao) {
            try {
                conteudo = await fs.readFile(arquivoDadosPadrao, 'utf-8');
            } catch (erroPadrao) {
                return estruturaVazia();
            }
        } else {
            return estruturaVazia();
        }
    }

    try {
        const dados = JSON.parse(conteudo);
        return {
            profissionais: Array.isArray(dados.profissionais) ? dados.profissionais : [],
            sessoes: Array.isArray(dados.sessoes) ? dados.sessoes : [],
            participantes_sessoes: Array.isArray(dados.participantes_sessoes)
                ? dados.participantes_sessoes
                : [],
            usuarios: Array.isArray(dados.usuarios) ? dados.usuarios : [],
        };
    } catch (error) {
        return estruturaVazia();
    }
}

/**
 * Persiste os dados no arquivo JSON (indentado para leitura humana).
 * Cria o diretório destino quando ainda não existe (primeira escrita
 * em um volume/ambiente novo).
 *
 * @param {object} dados Objeto completo de dados já alterado em memória.
 */
export async function salvarDados(dados) {
    await fs.mkdir(path.dirname(arquivoDados), { recursive: true });
    await fs.writeFile(arquivoDados, JSON.stringify(dados, null, 2), 'utf-8');
}

/**
 * Gera o próximo id numérico de uma coleção (maior id atual + 1).
 *
 * @param {Array<{id: number}>} lista Coleção que receberá o novo registro.
 * @returns {number} Id a ser usado no próximo cadastro.
 */
export function proximoId(lista) {
    return lista.reduce((maiorId, item) => {
        const id = Number(item?.id) || 0;
        return Math.max(maiorId, id);
    }, 0) + 1;
}
