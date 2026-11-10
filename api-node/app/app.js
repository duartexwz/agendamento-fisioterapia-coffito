/**
 * Aplicação Express central da API "Agendamento Saúde Ocupacional".
 *
 * Responsabilidades:
 * - Desabilitar ETag/Cache-Control para o axios não tratar 304 como erro.
 * - Liberar CORS (o front roda em outra porta/origem em dev e produção).
 * - Registrar o parser de JSON e montar todos os routers sob /api/v1.
 * - Responder status da API na raiz e 404 JSON para rotas desconhecidas.
 */
import express from 'express';
import cors from 'cors';
import { profissionaisRouter } from './routes/profissionaisRoutes.js';
import { sessoesRouter } from './routes/sessoesRoutes.js';
import { participantesSessaoRouter } from './routes/participantesSessaoRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';

const app = express();

// Evita respostas 304 em GETs: o axios trata 304 como erro e a tela
// ficaria sem dados após a primeira consulta.
app.set('etag', false);
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// Aceita requisições de qualquer origem com os métodos/cabeçalhos usados
// pelo front (inclui Authorization para o token Bearer do login).
const corsOptions = {
    origin: true,
    methods: ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());

// Todos os endpoints ficam sob o prefixo /api/v1.
app.use('/api/v1', profissionaisRouter, sessoesRouter, participantesSessaoRouter, authRouter, adminRouter);

// Health check simples da API.
app.get('/', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'API Agendamento Saúde Ocupacional' });
});

// Qualquer rota não mapeada cai aqui (resposta JSON em vez de HTML).
app.use((req, res) => {
    res.status(404).json({ message: 'Rota não encontrada.' });
});

export { app };
