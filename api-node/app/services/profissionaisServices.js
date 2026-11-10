/**
 * Regras de negócio de profissionais.
 *
 * Cada handler é um controller Express que lê/escreve no arquivo de dados
 * via lib/dados.js. Regras principais:
 * - Nome é único (cadastro e atualização rejeitam duplicados).
 * - Profissional com sessões cadastradas não pode ser excluído.
 */
import { lerDados, salvarDados, proximoId } from '../lib/dados.js';

/* ------------------------------- Leitura -------------------------------- */

/**
 * GET /profissionais/buscar (1º handler).
 * Sem query params devolve a lista completa; com query params guarda a
 * lista em `res.locals` e chama `next()` para o filtro responder.
 */
export async function listarProfissionais(req, res, next) {
    try {
        const dados = await lerDados();
        const profissionais = dados.profissionais;
        const temFiltros = Object.keys(req.query).length > 0;

        if (!temFiltros) {
            return res.status(200).json(profissionais);
        }

        res.locals.profissionaisCompartilhados = profissionais;
        return next();
    } catch (error) {
        console.error('Erro ao listar profissionais:', error.message);
        return res.status(500).send('Erro ao listar profissionais');
    }
}

/**
 * GET /profissionais/buscar (2º handler, quando há filtros).
 * Filtra por `nome` e `profissao` (parcial, sem diferenciar maiúsculas).
 */
export function filtrarProfissionais(req, res) {
    try {
        const profissionais = res.locals.profissionaisCompartilhados || [];
        const { nome, profissao } = req.query;

        const filtrados = profissionais.filter((profissional) => {
            if (
                nome &&
                !String(profissional.nome ?? '')
                    .toLowerCase()
                    .includes(String(nome).toLowerCase())
            ) {
                return false;
            }

            if (
                profissao &&
                !String(profissional.profissao ?? '')
                    .toLowerCase()
                    .includes(String(profissao).toLowerCase())
            ) {
                return false;
            }

            return true;
        });

        if (filtrados.length === 0) {
            return res.status(404).send('Nenhum registro encontrado');
        }

        return res.status(200).json(filtrados);
    } catch (error) {
        console.error('Erro ao filtrar profissionais:', error.message);
        return res.status(500).send('Erro ao realizar a busca');
    }
}

/* ------------------------------ Cadastro -------------------------------- */

/**
 * POST /profissionais
 * Body: { nome, profissao }. Rejeita campos vazios (400) e nome duplicado
 * (409). Devolve 201 com o registro criado.
 */
export async function cadastrarProfissionais(req, res) {
    try {
        const dados = await lerDados();
        const nome = String(req.body?.nome ?? '').trim();
        const profissao = String(req.body?.profissao ?? '').trim();

        if (!nome || !profissao) {
            return res.status(400).send('Os campos nome e profissao são obrigatórios.');
        }

        const profissionalExiste = dados.profissionais.some(
            (profissional) =>
                String(profissional.nome ?? '').trim().toLowerCase() === nome.toLowerCase(),
        );

        if (profissionalExiste) {
            return res.status(409).send('O profissional já está cadastrado no sistema.');
        }

        const novoProfissional = {
            id: proximoId(dados.profissionais),
            nome,
            profissao,
        };

        dados.profissionais.push(novoProfissional);
        await salvarDados(dados);

        return res.status(201).json({
            mensagem: 'Profissional cadastrado com sucesso!',
            dados: novoProfissional,
        });
    } catch (error) {
        console.error('Erro ao cadastrar profissional:', error.message);
        return res.status(500).send('Erro ao cadastrar profissional');
    }
}

/* ----------------------------- Atualização ------------------------------ */

/**
 * PUT /profissionais/atualizar/:id
 * Body: { nome?, profissao? }. Campos ausentes mantêm os valores atuais;
 * rejeita 404 (id inexistente), 400 (campos vazios) e 409 (nome em uso).
 */
export async function atualizarProfissionais(req, res) {
    try {
        const dados = await lerDados();
        const id = Number(req.params.id);
        const index = dados.profissionais.findIndex(
            (profissional) => Number(profissional.id) === id,
        );

        if (index === -1) {
            return res.status(404).send('Profissional não encontrado');
        }

        const atual = dados.profissionais[index];
        const nomeFinal =
            req.body?.nome !== undefined ? String(req.body.nome).trim() : atual.nome;
        const profissaoFinal =
            req.body?.profissao !== undefined
                ? String(req.body.profissao).trim()
                : atual.profissao;

        if (!nomeFinal || !profissaoFinal) {
            return res.status(400).send('Os campos nome e profissao são obrigatórios.');
        }

        const nomeEmUso = dados.profissionais.some(
            (profissional) =>
                Number(profissional.id) !== id &&
                String(profissional.nome ?? '').trim().toLowerCase() ===
                    nomeFinal.toLowerCase(),
        );

        if (nomeEmUso) {
            return res.status(409).send('Já existe um profissional com esse nome.');
        }

        dados.profissionais[index] = {
            ...atual,
            nome: nomeFinal,
            profissao: profissaoFinal,
        };

        await salvarDados(dados);

        return res.status(200).json({
            message: 'Profissional atualizado com sucesso',
            dados: dados.profissionais[index],
        });
    } catch (error) {
        console.error('Erro ao atualizar profissional:', error.message);
        return res.status(500).send('Erro ao atualizar o profissional');
    }
}

/* ------------------------------ Exclusão -------------------------------- */

/**
 * DELETE /profissionais/deletar/:id
 * Rejeita com 409 se o profissional ainda tiver sessões vinculadas
 * (mantém o histórico de eventos consistente).
 */
export async function deleteProfissionais(req, res) {
    try {
        const dados = await lerDados();
        const id = Number(req.params.id);
        const index = dados.profissionais.findIndex(
            (profissional) => Number(profissional.id) === id,
        );

        if (index === -1) {
            return res.status(404).send('Profissional não encontrado');
        }

        const possuiSessao = dados.sessoes.some(
            (sessao) => Number(sessao.profissional_id) === id,
        );

        if (possuiSessao) {
            return res
                .status(409)
                .send('Não é possível remover um profissional que possui sessões cadastradas.');
        }

        dados.profissionais.splice(index, 1);
        await salvarDados(dados);

        return res.status(200).json({ message: 'Profissional excluído com sucesso!' });
    } catch (error) {
        console.error('Erro ao excluir profissional:', error.message);
        return res.status(500).send('Erro ao excluir o profissional');
    }
}
