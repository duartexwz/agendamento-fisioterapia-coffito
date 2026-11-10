/**
 * Testes de CRUD do recurso /api/v1/participantes (Jest + Supertest).
 *
 * O banco em memória já nasce com uma sessão (id 1, 5 vagas) para
 * exercitar inscrições e o controle de vagas. O fs/promises é mockado
 * com `unstable_mockModule` (ESM) e a app é importada após o mock.
 * Executar com: npm test.
 */
import { it, describe, jest, expect, beforeEach } from '@jest/globals';


let mockDatabase = {
    sessoes: [{ id: 1, nome: 'Sessão teste', vagas: 5, vagas_totais: 5 }],
    participantes_sessoes: [],
};

jest.unstable_mockModule('fs/promises', () => ({
    default: {
        readFile: jest.fn(async () => JSON.stringify(mockDatabase)),
        writeFile: jest.fn(async (caminho, dadosString) => {
            mockDatabase = JSON.parse(dadosString);
        }),
    },
    readFile: jest.fn(async () => JSON.stringify(mockDatabase)),
    writeFile: jest.fn(async (caminho, dadosString) => {
        mockDatabase = JSON.parse(dadosString);
    }), 
}))

const { default: request } = await import('supertest');
const { app } = await import('../app/app.js');

describe('Testes de CRUD da API', () => {
    beforeEach(() => {
        mockDatabase = {
            sessoes: [{ id: 1, nome: 'Sessão teste', vagas: 5, vagas_totais: 5 }],
            participantes_sessoes: [],
        }
    }); //Limpa o banco antes de iniciar os testes


    it('C - Cadastra um novo participante na sessao', async() => {
        const cadastroParticipante = await request(app)
            .post('/api/v1/participantes/')
            .send({
                nome: 'Nome do participante',
                setor: 'Setor teste',
                sessao_id: 1,
            });

        expect(cadastroParticipante.statusCode).toBe(201);
        expect(cadastroParticipante.body.dados).toMatchObject({
            nome: 'Nome do participante',
            setor: 'Setor teste',
            sessao_id: 1,
        });

        expect(mockDatabase.participantes_sessoes.length).toBe(1);
        expect(mockDatabase.sessoes[0].vagas).toBe(4);
    });
    it('R - Deve ler os dados de um participante', async () => {

        const novoParticipante = {
            id: 1,
            nome: 'Profissional Teste Read', // Cria uma nova sessão para leitura dos dados;
            profissao: 'Profissão Teste Read'
        };

        mockDatabase.participantes_sessoes.push(novoParticipante);

        const getResponse = await request(app)
            .get('/api/v1/participantes/buscar');

        expect(getResponse.statusCode).toBe(200); // Verifica se o status da requisição é retornado corretamente;
        expect(Array.isArray(getResponse.body)).toBe(true); // Verifica se a resposta vinda do endpoint é um array;

        const filterResponse = await request(app)
            .get(`/api/v1/participantes/buscar/?nome=${novoParticipante.nome}`);

        expect(filterResponse.statusCode).toBe(200);
        expect(filterResponse.body[0].nome).toBe(novoParticipante.nome);

    });
    it('U - Deve atualizar um participante', async() => {
        mockDatabase.participantes_sessoes.push({
            id: 1,
            nome: 'Profissional Update', // Cria o participante que irá ser atualizado 
            setor: 'Setor Update',
            sessao_id: 1,
        });

        const updateResponse = await request(app)
            .put('/api/v1/participantes/atualizar/1')
            .send({
                nome: 'participante atualizado'
            });


        expect(updateResponse.statusCode).toBe(200);
        expect(updateResponse.body.dados.nome).toBe('participante atualizado');
    });
    it('D - Deve deletar um participante da sessao', async () => {

        mockDatabase.participantes_sessoes.push({
            id: 1,
            nome: 'Participante a ser deletado',
            setor: 'Setor teste',
            sessao_id: 1,
        });

        const deleteResponse = await request(app)
            .delete('/api/v1/participantes/deletar/1');

        expect(deleteResponse.statusCode).toBe(200);
        

        const getDeleteResponse = await request(app)
            .get('/api/v1/participantes/buscar/?nome=Participante a ser deletado');

        expect(getDeleteResponse.statusCode).toBe(404);

    })
})