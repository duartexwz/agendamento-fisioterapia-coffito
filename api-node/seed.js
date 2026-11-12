// ===========================
// CADASTRO DE ADMIN INICIAL
// ===========================

/**
 * Seed executado na subida do servidor (server.js): garante que exista
 * pelo menos um administrador para o primeiro login no painel.
 *
 * Lê ADMIN_NOME, ADMIN_EMAIL e ADMIN_PASSWORD do ambiente (.env /
 * docker-compose); sem e-mail ou senha o seed é ignorado. Se já houver
 * usuário com o e-mail informado, nada é alterado (seed idempotente).
 */

// Reutiliza as mesmas funções de persistência/hash usadas pelos services.
import { pathToFileURL } from 'node:url';
import { lerDados, salvarDados } from './app/lib/dados.js';
import { hashSenha, normalizarEmail, proximoId } from './app/lib/dados.js';

export async function criarAdminInicial() {
    const nome = String(process.env.ADMIN_NOME ?? 'Administrador').trim();
    const emailRaw = process.env.ADMIN_EMAIL;
    const senha = process.env.ADMIN_PASSWORD;

    if (!emailRaw || !senha) {
        console.warn(' Variáveis ADMIN_EMAIL ou ADMIN_PASSWORD não encontradas no .env. Seed ignorado.');
        return;
    }

    const email = normalizarEmail(emailRaw);

    try {
        const dados = await lerDados();
        if (!Array.isArray(dados.usuarios)) dados.usuarios = [];

        // Verifica se já existe algum usuário com o e-mail do admin
        const adminExiste = dados.usuarios.some((item) => normalizarEmail(item.email) === email);

        if (!adminExiste) {
            const novoAdmin = {
                id: proximoId(dados.usuarios),
                nome,
                email,
                senha: hashSenha(senha),
                criadoEm: new Date().toISOString(),
            };

            dados.usuarios.push(novoAdmin);
            await salvarDados(dados);

            console.log('✅ Seed: Administrador inicial criado com sucesso!');
        } else {
            console.log('⚡ Seed: Administrador inicial já existe. Nenhuma ação necessária.');
        }
    } catch (error) {
        console.error('❌ Erro ao rodar o seed de administrador:', error);
    }
}

/**
 * Execução direta (`node seed.js` / `npm run seed`), usada localmente e
 * pelo deploy na Vercel através do script `vercel-build`.
 *
 * Fora da Vercel tenta carregar o .env local para obter as variáveis
 * ADMIN_*; dentro da Vercel as variáveis vêm do painel do projeto.
 */
const executadoDiretamente =
    process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDiretamente) {
    if (!process.env.VERCEL) {
        for (const arquivoEnv of ['.env', '../.env']) {
            try {
                process.loadEnvFile(arquivoEnv);
                break;
            } catch (error) {
                // .env ausente neste diretório: segue com o ambiente atual.
            }
        }
    }

    criarAdminInicial().catch((error) => {
        console.error('❌ Erro ao executar o seed de administrador:', error);
        process.exitCode = 1;
    });
}
