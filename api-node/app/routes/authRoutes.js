/**
 * Rotas de autenticação e de gestão de usuários (sob /api/v1).
 *
 * Endpoints:
 * - POST   /auth/login          → valida e-mail/senha e devolve o token.
 * - GET    /auth/me             → dados do usuário autenticado [protegida].
 * - GET    /auth/usuarios       → lista administradores [protegida].
 * - GET    /auth/usuarios/:id   → busca um administrador [protegida].
 * - PUT    /auth/usuarios/:id   → atualiza um administrador [protegida].
 * - DELETE /auth/usuarios/:id   → exclui um administrador [protegida].
 *
 * `[protegida]` = usa o middleware `autenticar`, que exige o cabeçalho
 * `Authorization: Bearer <token>` e popula `req.usuario` com o payload.
 */
import { Router } from 'express';
import {
    autenticar,
    login,
    me
} from '../services/authServices.js';

import {
    listarAdministradores,
    buscarAdministrador,
    atualizarAdministrador,
    excluirAdministrador,
} from '../services/adminServices.js'

const router = Router();

router.post('/auth/login', login);
router.get('/auth/me', autenticar, me);

router.get('/auth/usuarios', autenticar, listarAdministradores);
router.get('/auth/usuarios/:id', autenticar, buscarAdministrador);
router.put('/auth/usuarios/:id', autenticar, atualizarAdministrador);
router.delete('/auth/usuarios/:id', autenticar, excluirAdministrador);


export { router as authRouter };