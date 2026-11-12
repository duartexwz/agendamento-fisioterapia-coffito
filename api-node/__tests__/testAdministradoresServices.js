/**
 * Testes de administradores e autenticação (Jest + Supertest).
 *
 * Cobre os fluxos usados pelo painel de administração:
 * - login (POST /auth/login) devolvendo token Bearer;
 * - proteção das rotas de administrador (401 sem token);
 * - cadastro via POST /administrador (com token obrigatório);
 * - atualização/exclusão via PUT e DELETE /auth/usuarios/:id;
 * - impedimento de autoexclusão.
 *
 * O fs/promises é mockado com `unstable_mockModule` (ESM) simulando o
 * banco JSON em memória; o banco já nasce com um admin (hash scrypt
 * real, gerado pelo próprio lib/dados.js) para viabilizar o login.
 * Executar com: npm test.
 */
import { it, describe, jest, expect, beforeEach } from '@jest/globals';

// Banco em memória, reiniciado antes de cada teste.
let mockDatabase = { usuarios: [] };

jest.unstable_mockModule('fs/promises', () => ({
    default: {
        readFile: jest.fn(async () => JSON.stringify(mockDatabase)), mkdir: jest.fn(async () => {}),
        writeFile: jest.fn(async (caminho, dadosString) => {
            mockDatabase = JSON.parse(dadosString);
        }),
    },
    readFile: jest.fn(async () => JSON.stringify(mockDatabase)), mkdir: jest.fn(async () => {}),
    writeFile: jest.fn(async (caminho, dadosString) => {
        mockDatabase = JSON.parse(dadosString);
    }),
}));

// Imports dinâmicos APÓS o mock do fs (mesmo padrão dos demais testes).
const { default: request } = await import('supertest');
const { app } = await import('../app/app.js');
const { hashSenha } = await import('../app/lib/dados.js');

const SENHA_ADMIN = 'senha123';

/** Banco inicial: um único administrador para o login dos testes. */
function bancoInicial() {
    return {
        usuarios: [
            {
                id: 1,
                nome: 'Admin Root',
                email: 'root@teste.local',
                senha: hashSenha(SENHA_ADMIN),
                criadoEm: new Date().toISOString(),
            },
        ],
    };
}

/** Faz login e devolve o token para autenticar as demais chamadas. */
async function obterToken(email = 'root@teste.local', senha = SENHA_ADMIN) {
    const resposta = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, senha });
    return resposta.body.token;
}

describe('Autenticação e administradores', () => {
    beforeEach(() => {
        mockDatabase = bancoInicial();
    });

    it('Deve fazer login e devolver um token', async () => {
        const resposta = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'root@teste.local', senha: SENHA_ADMIN });

        expect(resposta.status).toBe(200);
        expect(resposta.body.token).toBeTruthy();
        expect(resposta.body.usuario.email).toBe('root@teste.local');
    });

    it('Deve rejeitar login com senha inválida', async () => {
        const resposta = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'root@teste.local', senha: 'errada' });

        expect(resposta.status).toBe(401);
    });

    it('Deve bloquear rota de administrador sem token', async () => {
        const resposta = await request(app).get('/api/v1/auth/usuarios');

        expect(resposta.status).toBe(401);
    });

    it('Deve cadastrar administrador com token (POST /administrador)', async () => {
        const token = await obterToken();

        const resposta = await request(app)
            .post('/api/v1/administrador')
            .set('Authorization', `Bearer ${token}`)
            .send({ nome: 'Novo Admin', email: 'novo@teste.local', senha: 'senha123' });

        expect(resposta.status).toBe(201);
        expect(resposta.body.usuario.email).toBe('novo@teste.local');
        expect(mockDatabase.usuarios).toHaveLength(2);
    });

    it('Deve atualizar administrador via PUT /auth/usuarios/:id', async () => {
        const token = await obterToken();

        const resposta = await request(app)
            .put('/api/v1/auth/usuarios/1')
            .set('Authorization', `Bearer ${token}`)
            .send({ nome: 'Root Atualizado' });

        expect(resposta.status).toBe(200);
        expect(resposta.body.nome).toBe('Root Atualizado');
    });

    it('Deve impedir excluir o próprio usuário', async () => {
        const token = await obterToken();

        const resposta = await request(app)
            .delete('/api/v1/auth/usuarios/1')
            .set('Authorization', `Bearer ${token}`);

        expect(resposta.status).toBe(400);
    });

    it('Deve excluir outro administrador via DELETE /auth/usuarios/:id', async () => {
        const token = await obterToken();

        await request(app)
            .post('/api/v1/administrador')
            .set('Authorization', `Bearer ${token}`)
            .send({ nome: 'Temporario', email: 'temp@teste.local', senha: 'senha123' });

        const resposta = await request(app)
            .delete('/api/v1/auth/usuarios/2')
            .set('Authorization', `Bearer ${token}`);

        expect(resposta.status).toBe(200);
        expect(mockDatabase.usuarios).toHaveLength(1);
    });
});
