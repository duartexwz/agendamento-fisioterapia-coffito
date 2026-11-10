/**
 * Rotas de profissionais (montadas sob o prefixo /api/v1).
 *
 * Endpoints:
 * - GET    /profissionais/buscar          → lista todos; com query params
 *   (?nome=&profissao=) encadeia o filtro.
 * - POST   /profissionais                 → cadastra um profissional.
 * - PUT    /profissionais/atualizar/:id   → atualiza um profissional.
 * - DELETE /profissionais/deletar/:id     → remove um profissional.
 *
 * A leitura usa dois handlers encadeados: `listarProfissionais` devolve a
 * lista inteira quando não há filtros, e repassa via `res.locals` para
 * `filtrarProfissionais` quando a URL traz query params.
 */
import express from 'express';
import { cadastrarProfissionais, listarProfissionais, atualizarProfissionais, deleteProfissionais, filtrarProfissionais } from '../services/profissionaisServices.js';

// Cria as rotas da API
const router = express.Router();

router.get('/profissionais/buscar', listarProfissionais, filtrarProfissionais);
router.post('/profissionais',cadastrarProfissionais);
router.put('/profissionais/atualizar/:id', atualizarProfissionais);
router.delete('/profissionais/deletar/:id', deleteProfissionais);

export { router as profissionaisRouter }