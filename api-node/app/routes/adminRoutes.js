/**
 * Rotas de CRUD de administradores (sob /api/v1) — todas protegidas pelo
 * middleware `autenticar` (token Bearer obrigatório).
 *
 * Endpoints:
 * - POST   /administrador                → cria um administrador e devolve
 *   token de acesso.
 * - GET    /administrador/buscar         → lista administradores.
 * - PUT    /administrador/atualizar/:id  → atualiza nome/e-mail/senha.
 * - DELETE /administrador/deletar/:id    → exclui um administrador (impede
 *   autoexclusão e exclusão do último admin via `req.usuario` do token).
 */
import { Router } from 'express';
import { autenticar } from '../services/authServices.js';
import {
    criarAdmin,
    listarAdministradores,
    atualizarAdministrador,
    excluirAdministrador
} from '../services/adminServices.js';

const router = Router();

router.post('/administrador', autenticar, criarAdmin);
router.get('/administrador/buscar', autenticar, listarAdministradores);
router.put('/administrador/atualizar/:id', autenticar, atualizarAdministrador);
router.delete('/administrador/deletar/:id', autenticar, excluirAdministrador);


export { router as adminRouter };