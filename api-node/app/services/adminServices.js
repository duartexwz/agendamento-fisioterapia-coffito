/**
 * Regras de negócio de administradores (usuários com acesso ao painel).
 *
 * Regras principais:
 * - E-mail é único entre os usuários (409 em duplicados).
 * - Senha mínima de 6 caracteres, sempre persistida com hash scrypt.
 * - Não é permitido excluir o próprio usuário nem o último administrador.
 */
import { lerDados, salvarDados, proximoId, hashSenha, normalizarEmail } from '../lib/dados.js';
import { gerarToken } from './authServices.js';



/**
 * POST /administrador
 * Body: { nome, email, senha } (aceita `name`/`password` como alias).
 * Cria o usuário e já devolve um token de acesso, poupando um login.
 */
export async function criarAdmin(req, res) {
    const nome = String(req.body?.nome ?? req.body?.name ?? '').trim();
    const email = normalizarEmail(req.body?.email);
    const senha = String(req.body?.senha ?? req.body?.password ?? '');

    if (!nome || !email || !senha) {
        return res.status(400).json({ message: 'Nome, e-mail e senha são obrigatórios.' });
    }

    if (senha.length < 6) {
        return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    try {
        const dados = await lerDados();
        if (!Array.isArray(dados.usuarios)) dados.usuarios = [];

        if (dados.usuarios.some((item) => normalizarEmail(item.email) === email)) {
            return res.status(409).json({ message: 'Já existe um usuário com este e-mail.' });
        }

        const novoUsuario = {
            id: proximoId(dados.usuarios),
            nome,
            email,
            senha: hashSenha(senha),
            criadoEm: new Date().toISOString(),
        };

        dados.usuarios.push(novoUsuario);
        await salvarDados(dados);

        const token = gerarToken(novoUsuario);

        return res.status(201).json({
            token,
            accessToken: token,
            usuario: {
                id: novoUsuario.id,
                nome: novoUsuario.nome,
                email: novoUsuario.email,
            },
            user: {
                id: novoUsuario.id,
                name: novoUsuario.nome,
                email: novoUsuario.email,
            },
        });
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        return res.status(500).json({ message: 'Erro ao registrar usuário.' });
    }
}
/* ----------------------------- CRUD de administradores ----------------------------- */

/**
 * GET /administrador/buscar (e GET /auth/usuarios)
 * Lista os administradores sem expor o hash das senhas.
 */
export async function listarAdministradores(req, res) {
    try {
        const dados = await lerDados();
        const usuarios = Array.isArray(dados.usuarios) ? dados.usuarios : [];

        return res.status(200).json(
            usuarios.map((usuario) => ({
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                criadoEm: usuario.criadoEm ?? null,
            })),
        );
    } catch (error) {
        console.error('Erro ao listar administradores:', error);
        return res.status(500).json({ message: 'Erro ao listar administradores.' });
    }
}

/** GET /administrador/buscar/:id — busca um administrador pelo id. */
export async function buscarAdministrador(req, res) {
    try {
        const dados = await lerDados();
        const usuarios = Array.isArray(dados.usuarios) ? dados.usuarios : [];
        const usuario = usuarios.find((item) => String(item.id) === String(req.params.id));

        if (!usuario) {
            return res.status(404).json({ message: 'Administrador não encontrado.' });
        }

        return res.status(200).json({
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            criadoEm: usuario.criadoEm ?? null,
        });
    } catch (error) {
        console.error('Erro ao buscar administrador:', error);
        return res.status(500).json({ message: 'Erro ao buscar administrador.' });
    }
}


/**
 * PUT /administrador/atualizar/:id
 * Body parcial: { nome?, email?, senha? }. Senha só é trocada quando
 * enviada (e precisa ter no mínimo 6 caracteres).
 */
export async function atualizarAdministrador(req, res) {
    const id = req.params.id;

    try {
        const dados = await lerDados();
        if (!Array.isArray(dados.usuarios)) dados.usuarios = [];

        const indice = dados.usuarios.findIndex((item) => String(item.id) === String(id));
        if (indice === -1) {
            return res.status(404).json({ message: 'Administrador não encontrado.' });
        }

        const atual = dados.usuarios[indice];
        const nome = req.body?.nome !== undefined ? String(req.body.nome).trim() : atual.nome;
        const email = req.body?.email !== undefined ? normalizarEmail(req.body.email) : atual.email;
        const senha = req.body?.senha ?? req.body?.password;

        if (!nome || !email) {
            return res.status(400).json({ message: 'Nome e e-mail são obrigatórios.' });
        }

        if (dados.usuarios.some((item, i) => i !== indice && normalizarEmail(item.email) === email)) {
            return res.status(409).json({ message: 'Já existe um administrador com este e-mail.' });
        }

        if (senha !== undefined && senha !== null && String(senha).trim() !== '') {
            if (String(senha).length < 6) {
                return res.status(400).json({ message: 'A senha deve ter pelo menos 6 caracteres.' });
            }
            atual.senha = hashSenha(senha);
        }

        atual.nome = nome;
        atual.email = email;

        await salvarDados(dados);

        return res.status(200).json({
            id: atual.id,
            nome: atual.nome,
            email: atual.email,
            criadoEm: atual.criadoEm ?? null,
        });
    } catch (error) {
        console.error('Erro ao atualizar administrador:', error);
        return res.status(500).json({ message: 'Erro ao atualizar administrador.' });
    }
}

/**
 * DELETE /administrador/deletar/:id
 * Impede a autoexclusão (via `req.usuario` do token) e a exclusão do
 * último administrador, garantindo sempre um login disponível.
 */
export async function excluirAdministrador(req, res) {
    const id = req.params.id;

    try {
        const dados = await lerDados();
        if (!Array.isArray(dados.usuarios)) dados.usuarios = [];

        const indice = dados.usuarios.findIndex((item) => String(item.id) === String(id));
        if (indice === -1) {
            return res.status(404).json({ message: 'Administrador não encontrado.' });
        }

        if (String(req.usuario?.sub) === String(id)) {
            return res.status(400).json({ message: 'Não é possível excluir o próprio usuário.' });
        }

        if (dados.usuarios.length <= 1) {
            return res.status(400).json({ message: 'Não é possível excluir o último administrador.' });
        }

        dados.usuarios.splice(indice, 1);
        await salvarDados(dados);

        return res.status(200).json({ message: 'Administrador removido com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir administrador:', error);
        return res.status(500).json({ message: 'Erro ao excluir administrador.' });
    }
}
