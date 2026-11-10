/**
 * Rotas de sessões/eventos (montadas sob o prefixo /api/v1).
 *
 * Endpoints:
 * - GET    /sessoes/buscar          → lista todas; com query params
 *   (?nome=&dia=&modalidade=&profissional_id=&vagas=&start=&end=) encadeia
 *   o filtro (start/end são o intervalo enviado pelo FullCalendar).
 * - POST   /sessoes                 → cadastra uma sessão.
 * - PUT    /sessoes/atualizar/:id   → atualiza uma sessão.
 * - DELETE /sessoes/delete/:id      → remove a sessão e seus participantes.
 */
import express from 'express';
import { atualizarSessao, cadastrarSessao, deleteSessao, listarSessoes, filtrarSessoes } from '../services/sessoesServices.js';

const router = express.Router();

router.get('/sessoes/buscar', listarSessoes, filtrarSessoes)
router.post('/sessoes', cadastrarSessao);
router.put('/sessoes/atualizar/:id', atualizarSessao),
router.delete('/sessoes/delete/:id', deleteSessao);

export { router as sessoesRouter };