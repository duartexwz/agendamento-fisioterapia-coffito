/**
 * Autenticação da API: hashing de senha, token próprio estilo JWT e
 * middleware de proteção de rotas.
 *
 * O token é `base64url(payload).base64url(HMAC-SHA256(payload))` — mesmo
 * formato do JWT (header.payload.signature), sem biblioteca externa.
 * Payload: { sub, nome, email, iat, exp } com validade de 7 dias.
 * O segredo de assinatura vem de process.env.AUTH_SECRET.
 */
import crypto from 'crypto';
import { lerDados, salvarDados, proximoId } from '../lib/dados.js';

/** E-mail em minúsculas e sem espaços, para comparação consistente. */
function normalizarEmail(email) {
    return String(email ?? '').trim().toLowerCase();
}
const SEGredoPadrao = 'coffito-agendamento-secret-change-me';
const SEGREDO = process.env.AUTH_SECRET || SEGredoPadrao;


/** Gera o hash scrypt de uma senha no formato `scrypt$<salt>$<hash>`. */
export function hashSenha(senha) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(senha), salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
}

/**
 * Confere uma senha em texto puro contra o hash `scrypt$...` armazenado.
 * Usa timingSafeEqual para evitar ataques de temporização.
 */
export function verificarSenha(senha, armazenado) {
    try {
        const partes = String(armazenado ?? '').split('$');
        if (partes.length !== 3 || partes[0] !== 'scrypt') return false;

        const [, salt, hashArmazenado] = partes;
        const hashCalculado = crypto.scryptSync(String(senha), salt, 64).toString('hex');

        const bufferArmazenado = Buffer.from(hashArmazenado, 'hex');
        const bufferCalculado = Buffer.from(hashCalculado, 'hex');

        if (bufferArmazenado.length !== bufferCalculado.length) return false;
        return crypto.timingSafeEqual(bufferArmazenado, bufferCalculado);
    } catch (error) {
        return false;
    }
}

/** Monta o token assinado para um usuário (expira em 7 dias). */
export function gerarToken(usuario) {
    const payload = {
        sub: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        iat: Date.now(),
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const assinatura = crypto
        .createHmac('sha256', SEGREDO)
        .update(payloadBase64)
        .digest('base64url');

    return `${payloadBase64}.${assinatura}`;
}

/**
 * Valida assinatura e expiração de um token.
 * @returns {object|null} Payload decodificado, ou null se inválido/expirado.
 */
export function verificarToken(token) {
    try {
        const partes = String(token ?? '').split('.');
        if (partes.length !== 2) return null;

        const [payloadBase64, assinatura] = partes;
        const assinaturaEsperada = crypto
            .createHmac('sha256', SEGREDO)
            .update(payloadBase64)
            .digest('base64url');

        const bufferAssinatura = Buffer.from(assinatura, 'base64url');
        const bufferEsperada = Buffer.from(assinaturaEsperada, 'base64url');

        if (bufferAssinatura.length !== bufferEsperada.length) return null;
        if (!crypto.timingSafeEqual(bufferAssinatura, bufferEsperada)) return null;

        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf-8'));

        if (!payload?.exp || payload.exp < Date.now()) return null;

        return payload;
    } catch (error) {
        return null;
    }
}

/**
 * Middleware de rota protegida.
 * Lê o token do cabeçalho `Authorization: Bearer <token>`, valida e
 * popula `req.usuario` com o payload; responde 401 sem token válido.
 */
export function autenticar(req, res, next) {
    const cabecalho = String(req.headers.authorization ?? '');
    const token = cabecalho.startsWith('Bearer ')
        ? cabecalho.slice('Bearer '.length).trim()
        : null;

    if (!token) {
        return res.status(401).json({ message: 'Autenticação necessária.' });
    }

    const payload = verificarToken(token);
    if (!payload) {
        return res.status(401).json({ message: 'Token inválido ou expirado.' });
    }

    req.usuario = payload;
    return next();
}

/**
 * POST /auth/login
 * Body: { email, senha }. Busca o usuário no arquivo de dados, confere o
 * hash da senha e devolve { token, usuario } (formatos duplicados
 * `accessToken`/`user` por compatibilidade com consumidores antigos).
 */
export async function login(req, res) {
    const email = normalizarEmail(req.body?.email);
    const senha = String(req.body?.senha ?? req.body?.password ?? '');

    if (!email || !senha) {
        return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
    }

    try {
        const dados = await lerDados();
        const usuarios = Array.isArray(dados.usuarios) ? dados.usuarios : [];
        const usuario = usuarios.find(
            (item) => normalizarEmail(item.email) === email,
        );

        if (!usuario || !verificarSenha(senha, usuario.senha)) {
            return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
        }

        const token = gerarToken(usuario);

        return res.status(200).json({
            token,
            accessToken: token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
            },
            user: {
                id: usuario.id,
                name: usuario.nome,
                email: usuario.email,
            },
        });
    } catch (error) {
        console.error('Erro ao realizar login:', error);
        return res.status(500).json({ message: 'Erro ao realizar login.' });
    }
}

/** GET /auth/me — devolve o usuário do token validado pelo `autenticar`. */
export function me(req, res) {
    return res.status(200).json({
        usuario: {
            id: req.usuario?.sub ?? null,
            nome: req.usuario?.nome ?? '',
            email: req.usuario?.email ?? '',
        },
        user: {
            id: req.usuario?.sub ?? null,
            name: req.usuario?.nome ?? '',
            email: req.usuario?.email ?? '',
        },
    });
}
