/**
 * Servidor HTTP da API.
 *
 * - Execução local (`npm start`): sobe o Express na porta definida em
 *   `process.env.PORT` (padrão 3025) e roda o seed do administrador
 *   inicial logo após o servidor começar a escutar.
 * - Na Vercel (`VERCEL=1`): apenas exporta o app; a plataforma fica
 *   responsável por subir e escalar o servidor.
 */
import { app } from './app.js';
import { criarAdminInicial } from '../seed.js';


export { app };
export default app;

const isVercel = process.env.VERCEL === '1';

// Só abre a porta quando não estivermos em ambiente serverless.
if (!isVercel) {
    const PORT = process.env.PORT || 3025;

    app.listen(PORT, async() => {
        console.log(`A aplicação está rodando na porta ${PORT}`);
        // Garante um primeiro usuário com quem fazer login no painel.
        await criarAdminInicial();
    });
}