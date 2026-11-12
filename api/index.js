/**
 * Serverless function handler para o Vercel.
 *
 * Importa a aplicação Express e a expõe como default export,
 * que é o formato que o Vercel espera para funções serverless.
 */
import { app } from '../api-node/app/app.js';

export default app;
