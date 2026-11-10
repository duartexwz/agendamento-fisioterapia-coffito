/**
 * Testes de CRUD do recurso /api/v1/sessoes (Jest + Supertest).
 *
 * Estratégia: o módulo fs/promises é mockado com `unstable_mockModule`
 * (ESM), simulando o banco JSON em memória; os services são importados
 * dinamicamente DEPOIS do mock para garantir que usem a versão mockada.
 * Executar com: npm test (na pasta api-node).
 */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// 1. Variável compartilhada do banco de dados em memória
let mockDatabase = { sessoes: [] };

// 2. Mockamos apenas o fs/promises (leitura e escrita)
jest.unstable_mockModule('fs/promises', () => ({ //unstable_mockModule cria mocks de modulos nativos do ESM
    default: {
        readFile: jest.fn(async () => JSON.stringify(mockDatabase)),
        writeFile: jest.fn(async (caminho, dadosString) => {
            mockDatabase = JSON.parse(dadosString);
        })
    },
    readFile: jest.fn(async () => JSON.stringify(mockDatabase)),
    writeFile: jest.fn(async (caminho, dadosString) => {
        mockDatabase = JSON.parse(dadosString);
    })
}));

// 3. Importações dinâmicas APÓS registrar o mock do fs
const { default: request } = await import('supertest');
const { app } = await import('../app/app.js');

describe('Testes de CRUD da API com dados mocados', () => {
    beforeEach(() => {
        // Reinicia o banco em memória antes de cada teste
        mockDatabase = { sessoes: [] };
    });

    it('C - Deve criar uma nova sessão', async () => {
        const response = await request(app)
            .post('/api/v1/sessoes/')
            .send({
                nome: "Teste post 5",
                modalidade: "Saude da mulher",
                data: {
                    "dia": "20/12/2090",
                    "horario": "10:30"
                },
                profissional_id: 1,
                vagas: 10
            });

        expect(response.statusCode).toEqual(201);
        expect(response.body.dados).toMatchObject({
            "nome": "Teste post 5",
        });

        expect(mockDatabase.sessoes.length).toBe(1);
    });

    it('R - Deve Listar todos os usuarios', async () => {
        const novaSessao = {
            id: 1,
            nome: "Teste post 5",
            modalidade: "Saude da mulher",
            data: { "dia": "20/12/2090", "horario": "10:30" },
            profissional_id: 1,
            vagas: 10
        };
        mockDatabase.sessoes.push(novaSessao);

        const listResponse = await request(app).get('/api/v1/sessoes/buscar');
        expect(listResponse.statusCode).toBe(200);
        expect(Array.isArray(listResponse.body)).toBe(true);

        const filterResponse = await request(app).get(`/api/v1/sessoes/buscar/?nome=${novaSessao.nome}`);
        expect(filterResponse.statusCode).toBe(200);
        expect(filterResponse.body[0].nome).toBe(novaSessao.nome);
    });

    it('U - Deve atualizar a sessao', async () => {
        mockDatabase.sessoes.push({
            id: 1,
            nome: "Teste post 5",
            modalidade: "Saude da mulher",
            data: { "dia": "20/12/2090", "horario": "10:30" },
            profissional_id: 1,
            vagas: 10
        });

        const updateResponse = await request(app)
            .put('/api/v1/sessoes/atualizar/1')
            .send({
                nome: 'Teste Atualização',
                modalidade: "Saude da mulher",
                data: { "dia": "20/12/2090", "horario": "10:30" },
                profissional_id: 1,
                vagas: 10
            });

        expect(updateResponse.statusCode).toBe(200);
        expect(updateResponse.body.dados.nome).toBe('Teste Atualização');
    });

    it('D - Deve deletar a sessao', async () => {
        mockDatabase.sessoes.push({
            id: 1,
            nome: "Teste Atualização",
            modalidade: "Saude da mulher",
            data: { "dia": "20/12/2090", "horario": "10:30" },
            profissional_id: 1,
            vagas: 10
        });

        const deleteSessao = await request(app)
            .delete('/api/v1/sessoes/delete/1');

        expect(deleteSessao.statusCode).toBe(200);

        const getResponse = await request(app).get('/api/v1/sessoes/buscar/?nome=Teste Atualização');
        expect(getResponse.statusCode).toBe(404);
    });
});