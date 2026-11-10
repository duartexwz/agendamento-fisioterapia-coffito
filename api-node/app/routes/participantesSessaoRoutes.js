/**
 * Rotas de participantes (inscrições em sessões), montadas sob /api/v1.
 *
 * Endpoints:
 * - GET    /participantes/buscar          → lista todos; com query params
 *   (?nome=&setor=&sessao_id=) encadeia o filtro.
 * - POST   /participantes                 → inscreve um participante em uma
 *   sessão (decrementa a vaga da sessão).
 * - PUT    /participantes/atualizar/:id   → atualiza a inscrição (trocar de
 *   sessão devolve a vaga antiga e consome a nova).
 * - DELETE /participantes/deletar/:id     → remove a inscrição (devolve a vaga).
 */
import { listarParticipantes, filtrarParticipantes, cadastrarParticipanteSessao, atualizarParticipanteSessao, deleteParticipanteSessoes } from "../services/participantesServices.js";
import express from 'express';

const router = express.Router();

router.get('/participantes/buscar', listarParticipantes, filtrarParticipantes);
router.post('/participantes', cadastrarParticipanteSessao);
router.put('/participantes/atualizar/:id', atualizarParticipanteSessao);
router.delete('/participantes/deletar/:id', deleteParticipanteSessoes);

export { router as participantesSessaoRouter };
