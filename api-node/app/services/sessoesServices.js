/**
 * Regras de negócio de sessões/eventos de fisioterapia.
 *
 * Cada handler é um controller Express persistido no arquivo de dados.
 * Regras principais:
 * - Uma sessão ocupa um dia+horário único (cadastro e atualização
 *   rejeitam conflitos com 409).
 * - `vagas` é inteiro >= 0; `vagas_totais` guarda o total original para
 *   as barras de preenchimento do front.
 * - Excluir a sessão remove também seus participantes.
 */
import { lerDados, salvarDados, proximoId } from '../lib/dados.js';

/* ------------------------------- Leitura -------------------------------- */

/**
 * GET /sessoes/buscar (1º handler).
 * Sem query params devolve todas as sessões; com filtros repassa a lista
 * via `res.locals` para `filtrarSessoes`.
 */
export async function listarSessoes(req, res, next) {
    try {
        const dados = await lerDados();
        const sessoes = dados.sessoes;
        const temFiltros = Object.keys(req.query).length > 0;

        if (!temFiltros) {
            return res.status(200).json(sessoes);
        }

        res.locals.sessoesCompartilhadas = sessoes;
        return next();
    } catch (error) {
        return res.status(500).send(`Erro ao listar sessões: ${error.message}`);
    }
}

/**
 * GET /sessoes/buscar (2º handler, quando há filtros).
 * Query params: nome (parcial), dia (exato), modalidade (parcial),
 * profissional_id e vagas (exatos) e start/end — intervalo do FullCalendar
 * (start inclusivo, end exclusivo).
 */
export async function filtrarSessoes(req, res) {
    try {
        const sessoes = res.locals.sessoesCompartilhadas || [];
        const { nome, dia, modalidade, profissional_id, vagas, start, end } = req.query;

        const filtradas = sessoes.filter((sessao) => {
            if (
                nome &&
                !String(sessao.nome ?? '')
                    .toLowerCase()
                    .includes(String(nome).toLowerCase())
            ) {
                return false;
            }

            if (dia && String(sessao.data?.dia ?? '') !== String(dia)) {
                return false;
            }

            // Intervalo enviado pelo FullCalendar (end é exclusivo).
            if (start && String(sessao.data?.dia ?? '') < String(start).slice(0, 10)) {
                return false;
            }

            if (end && String(sessao.data?.dia ?? '') >= String(end).slice(0, 10)) {
                return false;
            }

            if (
                modalidade &&
                !String(sessao.modalidade ?? '')
                    .toLowerCase()
                    .includes(String(modalidade).toLowerCase())
            ) {
                return false;
            }

            if (
                profissional_id &&
                Number(sessao.profissional_id) !== Number(profissional_id)
            ) {
                return false;
            }

            if (vagas !== undefined && Number(sessao.vagas) !== Number(vagas)) {
                return false;
            }

            return true;
        });

        if (filtradas.length === 0) {
            return res.status(404).send('Nenhum registro encontrado');
        }

        return res.status(200).json(filtradas);
    } catch (error) {
        return res.status(500).send(`Erro na busca de dados: ${error.message}`);
    }
}

/* ------------------------------ Cadastro -------------------------------- */

/**
 * POST /sessoes
 * Body: { nome, data: { dia, horario }, modalidade, profissional_id, vagas }.
 * Valida campos obrigatórios, vagas inteira >= 0 e dia+horário livres.
 * Devolve 201 com a sessão criada (incluindo vagas_totais).
 */
export async function cadastrarSessao(req, res) {
    try {
        const dados = await lerDados();
        const { nome, data, modalidade, profissional_id, vagas } = req.body ?? {};

        const dia = String(data?.dia ?? '').trim();
        const horario = String(data?.horario ?? '').trim();
        const nomeFinal = String(nome ?? '').trim();
        const modalidadeFinal = String(modalidade ?? '').trim();
        const profissionalId = Number(profissional_id);
        const vagasFinal = Number(vagas);

        if (
            !nomeFinal ||
            !dia ||
            !horario ||
            !modalidadeFinal ||
            !profissional_id ||
            vagas === undefined ||
            vagas === null ||
            vagas === ''
        ) {
            return res.status(400).send(
                'Os campos nome, dia, horário, modalidade, profissional_id e vagas são obrigatórios.',
            );
        }

        if (!Number.isInteger(vagasFinal) || vagasFinal < 0) {
            return res
                .status(400)
                .send('O campo vagas deve ser um número inteiro maior ou igual a zero.');
        }

        const conflitoHorario = dados.sessoes.some(
            (sessao) =>
                String(sessao.data?.dia) === dia &&
                String(sessao.data?.horario) === horario,
        );

        if (conflitoHorario) {
            return res
                .status(409)
                .send('Já existe uma sessão cadastrada no horário solicitado.');
        }

        const novaSessao = {
            id: proximoId(dados.sessoes),
            nome: nomeFinal,
            modalidade: modalidadeFinal,
            data: { dia, horario },
            profissional_id: profissionalId,
            vagas: vagasFinal,
            vagas_totais: vagasFinal,
        };

        dados.sessoes.push(novaSessao);
        await salvarDados(dados);

        return res.status(201).json({
            message: 'Sessão cadastrada com sucesso',
            dados: novaSessao,
        });
    } catch (error) {
        return res.status(500).send(`Erro na aplicação: ${error.message}`);
    }
}

/* ----------------------------- Atualização ------------------------------ */

/**
 * PUT /sessoes/atualizar/:id
 * Body parcial: { nome?, data?, modalidade?, profissional_id?, vagas? }.
 * Campos ausentes preservam os valores atuais (vagas_totais só é
 * recalculada quando `vagas` é enviada).
 */
export async function atualizarSessao(req, res) {
    try {
        const dados = await lerDados();
        const id = Number(req.params.id);
        const index = dados.sessoes.findIndex((sessao) => Number(sessao.id) === id);

        if (index === -1) {
            return res.status(404).send('Sessão não encontrada');
        }

        const atual = dados.sessoes[index];
        const { nome, data, modalidade, profissional_id, vagas } = req.body ?? {};

        const diaFinal =
            data?.dia !== undefined ? String(data.dia).trim() : String(atual.data?.dia ?? '');
        const horarioFinal =
            data?.horario !== undefined
                ? String(data.horario).trim()
                : String(atual.data?.horario ?? '');
        const nomeFinal = nome !== undefined ? String(nome).trim() : atual.nome;
        const modalidadeFinal =
            modalidade !== undefined ? String(modalidade).trim() : atual.modalidade;
        const profissionalFinal =
            profissional_id !== undefined
                ? Number(profissional_id)
                : Number(atual.profissional_id);
        const vagasFinal = vagas !== undefined ? Number(vagas) : Number(atual.vagas);

        if (!nomeFinal || !diaFinal || !horarioFinal || !modalidadeFinal || !profissionalFinal) {
            return res.status(400).send(
                'Os campos nome, dia, horário, modalidade, profissional_id e vagas são obrigatórios.',
            );
        }

        if (!Number.isInteger(vagasFinal) || vagasFinal < 0) {
            return res
                .status(400)
                .send('O campo vagas deve ser um número inteiro maior ou igual a zero.');
        }

        const conflitoHorario = dados.sessoes.some(
            (sessao) =>
                Number(sessao.id) !== id &&
                String(sessao.data?.dia) === diaFinal &&
                String(sessao.data?.horario) === horarioFinal,
        );

        if (conflitoHorario) {
            return res
                .status(409)
                .send('Já existe uma sessão cadastrada no dia e horário solicitados.');
        }

        dados.sessoes[index] = {
            ...atual,
            nome: nomeFinal,
            data: { dia: diaFinal, horario: horarioFinal },
            modalidade: modalidadeFinal,
            profissional_id: profissionalFinal,
            vagas: vagasFinal,
            vagas_totais: vagas !== undefined ? vagasFinal : atual.vagas_totais ?? vagasFinal,
        };

        await salvarDados(dados);

        return res.status(200).json({
            message: 'Dados atualizados com sucesso!',
            dados: dados.sessoes[index],
        });
    } catch (error) {
        return res.status(500).send(`Erro ao atualizar sessão: ${error.message}`);
    }
}

/* ------------------------------ Exclusão -------------------------------- */

/**
 * DELETE /sessoes/delete/:id
 * Remove a sessão e, em cascata, todas as inscrições de participantes
 * vinculadas a ela (mantém dados.json sem órfãos).
 */
export async function deleteSessao(req, res) {
    try {
        const dados = await lerDados();
        const id = Number(req.params.id);
        const index = dados.sessoes.findIndex((sessao) => Number(sessao.id) === id);

        if (index === -1) {
            return res.status(404).send('Sessão não encontrada.');
        }

        dados.sessoes.splice(index, 1);

        // Remove também os participantes da sessão excluída.
        dados.participantes_sessoes = dados.participantes_sessoes.filter(
            (participante) => Number(participante.sessao_id) !== id,
        );

        await salvarDados(dados);

        return res.status(200).send('Sessão deletada com sucesso!');
    } catch (error) {
        return res.status(500).send(`Erro ao deletar sessão: ${error.message}`);
    }
}
