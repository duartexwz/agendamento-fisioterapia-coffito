/**
 * Ponto de entrada alternativo da API.
 *
 * Reexporta a aplicação Express configurada em ./app/app.js, permitindo que
 * plataformas de hospedagem (ex.: deploys serverless) importem o pacote
 * diretamente e gerenciem o servidor HTTP por conta própria.
 */
import { app } from './app/app.js';

export default app;
export { app };