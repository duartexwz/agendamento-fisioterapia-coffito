/**
 * Testes de CRUD do recurso /api/v1/profissionais (Jest + Supertest).
 *
 * O fs/promises é mockado com `unstable_mockModule` (ESM) simulando o
 * banco JSON em memória; os imports dinâmicos de supertest/app ocorrem
 * depois do mock para usar a versão mockada. Executar com: npm test.
 */
import { jest, describe, expect, beforeEach } from '@jest/globals';

// Cria o banco mocado
let mockDatabase = { profissionais: [] };

jest.unstable_mockModule('fs/promises', () => ({
    default: {
        readFile: jest.fn(async () => JSON.stringify(mockDatabase)), mkdir: jest.fn(async () => {}), // Para leitura, transforma em um JSON válido
        writeFile: jest.fn(async (caminho, dadosString) => {
            mockDatabase = JSON.parse(dadosString); // Para escrita, transforma em objeto.
        }),
    },
    readFile: jest.fn(async () => JSON.stringify(mockDatabase)), mkdir: jest.fn(async () => {}), // Para leitura, transforma em um JSON válido
        writeFile: jest.fn(async (caminho, dadosString) => {
            mockDatabase = JSON.parse(dadosString); // Para escrita, transforma em objeto.
        }),
})); // Simula um reequire usando jest no módulo ESM

const { default: request } = await import('supertest'); // Realiza o import do supertest e armazena na constante
const { app } = await import('../app/app.js'); // Iporta o App.js para realizarmos os testes


describe('Testes de CRUD da API', () => {
    beforeEach(() => {
        mockDatabase = { profissionais: [] }; // Limpa o banco falso antes de iniciar o teste;
    });
    it('C - Deve criar um novo profissional para a API', async () => {
        const response  = await request(app)
            .post('/api/v1/profissionais/')
            .send({
                nome: 'Profissional teste',
                profissao: 'Terapia Ocupacional'
            });
        expect(response.statusCode).toBe(201); // Compara apenas valores primitivos;
        expect(response.body.dados).toMatchObject({ // toMatch compara o objeto a um subconjuntos da propriedade do objeto;
            nome: 'Profissional teste',
            profissao: 'Terapia Ocupacional'
        });

        expect(mockDatabase.profissionais.length).toBe(1);
    });
    it('R - Deve ler os dados do profissional cadastrado', async () => {
        const novoProfissional = {
            id: 1,
            nome: 'Profissional Teste Read', // Cria uma nova sessão para leitura dos dados;
            profissao: 'Profissão Teste Read'
        };

        mockDatabase.profissionais.push(novoProfissional);

        const getResponse = await request(app)
            .get('/api/v1/profissionais/buscar');

        expect(getResponse.statusCode).toBe(200); // Verifica se o status da requisição é retornado corretamente;
        expect(Array.isArray(getResponse.body)).toBe(true); // Verifica se a resposta vinda do endpoint é um array;

        const filterResponse = await request(app)
            .get(`/api/v1/profissionais/buscar/?nome=${novoProfissional.nome}`);

        expect(filterResponse.statusCode).toBe(200);
        expect(filterResponse.body[0].nome).toBe(novoProfissional.nome);
    });
    it('U - Deve atualizar um profissional', async () => {
        mockDatabase.profissionais.push({
            id: 1,
            nome: 'Profissional Update', // Cria o profissional que irá ser atualizado 
            profissao: 'Profissao Update'
        });

        const updateResponse = await request(app)
            .put('/api/v1/profissionais/atualizar/1')
            .send({
                nome: 'Profissional Atualizado'
            });


        expect(updateResponse.statusCode).toBe(200);
        expect(updateResponse.body.dados.nome).toBe('Profissional Atualizado');
    });
    it('D - Deve deletar um profissional', async () => {
        mockDatabase.profissionais.push({
            id: 1,
            nome: 'Profissional a ser deletado',
            profissao: 'Profissao a ser deletada'
        });

        const deleteResponse = await request(app)
            .delete('/api/v1/profissionais/deletar/1');

        expect(deleteResponse.statusCode).toBe(200);
        

        const getDeleteResponse = await request(app)
            .get('/api/v1/profissionais/buscar/?nome=Profissional a ser deletado');

        expect(getDeleteResponse.statusCode).toBe(404);

    })
})