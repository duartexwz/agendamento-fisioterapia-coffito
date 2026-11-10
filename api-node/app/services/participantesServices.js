/**
 * Regras de negócio de participantes (inscrições em sessões).
 *
 * Regras principais:
 * - Inscricao usa o par (sessao_id, nome) como chave; duplicados → 409.
 * - Cadastrar consome 1 vaga da sessão; remover devolve 1 vaga.
 * - Trocar de sessão (PUT) devolve a vaga da sessão de origem e consome
 *   1 vaga da sessão de destino (que precisa ter vaga disponível).
 * - Sessão sem vagas → 409 nas inscrições/transferências.
 */
import { lerDados, salvarDados, proximoId } from '../lib/dados.js';

/** Compara dois ids como string (aceita número ou texto). */
function mesmoId(a, b) {
    return String(a) === String(b);
}

/** Localiza a sessão de um participante; null se não existir. */
function buscarSessao(dados, sessaoId) {
    // Alguns fluxos de teste trabalham apenas com participantes.
    if (!Array.isArray(dados.sessoes)) return null;
    return dados.sessoes.find((sessao) => mesmoId(sessao.id, sessaoId)) ?? null;
}

/** Informa se a sessão ainda pode receber inscrições. */
function sessaoTemVagas(sessao) {
    return !sessao || Number(sessao.vagas) > 0;
}

/** Consome 1 vaga da sessão (nunca fica negativa). */
function decrementarVaga(sessao) {
    if (!sessao) return;
    sessao.vagas = Math.max(0, Number(sessao.vagas) - 1);
}

/** Devolve 1 vaga para a sessão (cria vagas_totais se não existir). */
function incrementarVaga(sessao) {
    if (!sessao) return;
    sessao.vagas = Number(sessao.vagas) + 1;

    if (sessao.vagas_totais === undefined) {
        sessao.vagas_totais = sessao.vagas;
    }
}

/* ------------------------------- Leitura -------------------------------- */

/**
 * GET /participantes/buscar (1º handler).
 * Sem query params devolve todos; com filtros repassa via `res.locals`
 * para `filtrarParticipantes`.
 */
export async function listarParticipantes(req, res, next) {
    try {
        const dados = await lerDados();
        const participantes = dados.participantes_sessoes;
        const temFiltros = Object.keys(req.query).length > 0;

        if (!temFiltros) {
            return res.status(200).json(participantes);
        }

        res.locals.participantesCompartilhados = participantes;
        return next();
    } catch (error) {
        console.error('Erro ao listar participantes:', error.message);
        return res.status(500).send('Erro ao listar participantes.');
    }
}

/**
 * GET /participantes/buscar (2º handler, quando há filtros).
 * Query params: nome (parcial), setor (parcial) e sessao_id (exato).
 */
export async function filtrarParticipantes(req, res) {
    try {
        const participantes = res.locals.participantesCompartilhados || [];
        const { nome, setor, sessao_id } = req.query;

        const filtrados = participantes.filter((participante) => {
            if (
                nome &&
                !String(participante.nome ?? '')
                    .toLowerCase()
                    .includes(String(nome).toLowerCase())
            ) {
                return false;
            }

            if (
                setor &&
                !String(participante.setor ?? '')
                    .toLowerCase()
                    .includes(String(setor).toLowerCase())
            ) {
                return false;
            }

            if (sessao_id && !mesmoId(participante.sessao_id, Number(sessao_id))) {
                return false;
            }

            return true;
        });

        if (filtrados.length === 0) {
            return res.status(404).send('Nenhum resultado encontrado');
        }

        return res.status(200).json(filtrados);
    } catch (error) {
        console.error('Erro ao filtrar participantes:', error.message);
        return res.status(500).send('Erro ao filtrar participante.');
    }
}

/* ------------------------------ Cadastro -------------------------------- */

/**
 * POST /participantes
 * Body: { nome, setor, sessao_id }. Valida existência da sessão, vagas
 * disponíveis e duplicidade do nome na mesma sessão; ao concluir consome
 * 1 vaga e devolve 201 com a inscrição.
 */
export async function cadastrarParticipanteSessao(req, res) {
    try {
        const dados = await lerDados();
        const nome = String(req.body?.nome ?? '').trim();
        const setor = String(req.body?.setor ?? '').trim();
        const sessaoId = req.body?.sessao_id;

        if (!nome || !sessaoId || !setor) {
            return res
                .status(400)
                .send('Informações ausentes: nome, setor e sessao_id são obrigatórios.');
        }

        const sessao = buscarSessao(dados, sessaoId);

        if (Array.isArray(dados.sessoes) && !sessao) {
            return res.status(404).send('Sessão não encontrada.');
        }

        if (!sessaoTemVagas(sessao)) {
            return res.status(409).send('Esta sessão não possui mais vagas disponíveis.');
        }

        const participanteJaCadastrado = dados.participantes_sessoes.some(
            (participante) =>
                mesmoId(participante.sessao_id, sessaoId) &&
                String(participante.nome ?? '').trim().toLowerCase() === nome.toLowerCase(),
        );

        if (participanteJaCadastrado) {
            return res.status(409).send('Participante já cadastrado nesta sessão.');
        }

        const novoParticipante = {
            id: proximoId(dados.participantes_sessoes),
            nome,
            setor,
            sessao_id: sessao ? sessao.id : sessaoId,
        };

        dados.participantes_sessoes.push(novoParticipante);
        decrementarVaga(sessao);

        await salvarDados(dados);

        return res.status(201).json({
            message: 'Participante cadastrado com sucesso!',
            dados: novoParticipante,
        });
    } catch (error) {
        console.error('Erro ao cadastrar participante:', error.message);
        return res.status(500).send('Erro ao cadastrar a vaga.');
    }
}

/* ----------------------------- Atualização ------------------------------ */

/**
 * PUT /participantes/atualizar/:id
 * Body parcial: { nome?, setor?, sessao_id? }. Quando muda a sessão,
 * devolve a vaga da origem e consome 1 da destino (se houver vaga).
 */
export async function atualizarParticipanteSessao(req, res) {
    try {
        const dados = await lerDados();
        const id = Number(req.params.id);
        const index = dados.participantes_sessoes.findIndex(
            (participante) => Number(participante.id) === id,
        );

        if (index === -1) {
            return res.status(404).send('Participante não encontrado.');
        }

        const atual = dados.participantes_sessoes[index];
        const nomeFinal =
            req.body?.nome !== undefined ? String(req.body.nome).trim() : atual.nome;
        const setorFinal =
            req.body?.setor !== undefined ? String(req.body.setor).trim() : atual.setor;
        const sessaoFinal =
            req.body?.sessao_id !== undefined ? req.body.sessao_id : atual.sessao_id;

        if (!nomeFinal || !sessaoFinal) {
            return res.status(400).send('Os campos nome e sessao_id são obrigatórios.');
        }

        const sessaoAntiga = buscarSessao(dados, atual.sessao_id);
        const sessaoNova = buscarSessao(dados, sessaoFinal);
        const mudouDeSessao = !mesmoId(atual.sessao_id, sessaoFinal);

        if (Array.isArray(dados.sessoes) && !sessaoNova) {
            return res.status(404).send('Sessão não encontrada.');
        }

        if (mudouDeSessao && !sessaoTemVagas(sessaoNova)) {
            return res.status(409).send('A sessão de destino não possui vagas disponíveis.');
        }

        const participanteExiste = dados.participantes_sessoes.some(
            (participante) =>
                Number(participante.id) !== id &&
                mesmoId(participante.sessao_id, sessaoFinal) &&
                String(participante.nome ?? '').trim().toLowerCase() ===
                    nomeFinal.toLowerCase(),
        );

        if (participanteExiste) {
            return res.status(409).send('Participante já cadastrado nesta sessão.');
        }

        dados.participantes_sessoes[index] = {
            ...atual,
            nome: nomeFinal,
            setor: setorFinal,
            sessao_id: sessaoNova ? sessaoNova.id : sessaoFinal,
        };

        if (mudouDeSessao) {
            incrementarVaga(sessaoAntiga);
            decrementarVaga(sessaoNova);
        }

        await salvarDados(dados);

        return res.status(200).json({
            message: 'Participante atualizado com sucesso',
            dados: dados.participantes_sessoes[index],
        });
    } catch (error) {
        console.error('Erro ao atualizar participante:', error.message);
        return res.status(500).send('Erro ao atualizar o cadastro da vaga.');
    }
}

/* ------------------------------ Exclusão -------------------------------- */

/**
 * DELETE /participantes/deletar/:id
 * Remove a inscrição e devolve 1 vaga para a sessão correspondente.
 */
export async function deleteParticipanteSessoes(req, res) {
    try {
        const dados = await lerDados();
        const id = Number(req.params.id);
        const index = dados.participantes_sessoes.findIndex(
            (participante) => Number(participante.id) === id,
        );

        if (index === -1) {
            return res.status(404).send('Nenhum registro encontrado.');
        }

        const participante = dados.participantes_sessoes[index];
        const sessao = buscarSessao(dados, participante.sessao_id);

        dados.participantes_sessoes.splice(index, 1);
        incrementarVaga(sessao);

        await salvarDados(dados);

        return res.status(200).send('Participante removido com sucesso.');
    } catch (error) {
        console.error('Erro ao remover participante:', error.message);
        return res.status(500).send('Erro ao remover o participante.');
    }
}
