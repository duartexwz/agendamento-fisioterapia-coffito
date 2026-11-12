# Agendamento Saúde Ocupacional

Sistema de agendamento de sessões de fisioterapia/terapia ocupacional.
O front-end é **HTML, CSS e JavaScript puro** (sem frameworks e sem etapa de build)
e a API é feita em Node.js/Express com persistência em JSON.

## Estrutura

```text
.
├── api-node/                  # API Express
│   ├── app/
│   │   ├── app.js             # Configuração do Express e CORS
│   │   ├── server.js          # Inicialização do servidor
│   │   ├── lib/dados.js       # Leitura/escrita do dados.json
│   │   ├── routes/            # Rotas da API
│   │   └── services/          # Regras de negócio
│   ├── __tests__/             # Testes automatizados (Jest + Supertest)
│   ├── dados.json             # Base de dados local
│   ├── docker-compose.yml
│   └── Dockerfile
└── front/
    ├── index.html             # Página pública de agendamento
    ├── admin.html             # Painel administrativo
    └── src/
        ├── assets/            # Imagens
        ├── css/               # index.css e admin.css
        └── js/
            ├── components/    # Calendários (FullCalendar)
            ├── lib/           # API, datas e utilitários
            └── ui/            # Controllers das páginas
```

## Como executar

### 1. API e front-end juntos (Docker)

Na raiz do projeto:

```bash
docker compose up -d --build
```

Isso sobe dois containers separados:

- API: `http://localhost:3025/api/v1`
- Front-end: `http://localhost:3065`

### Persistência dos dados (Docker)

O `dados.json` (banco de dados da API) vive em um **volume nomeado**
(`agendamento_dados`), montado em `/app/data` do container da API via
`DATA_FILE=/app/data/dados.json`. Isso significa que:

- Os dados **sobrevivem a rebuilds** (`docker compose up -d --build`) e ao
  `docker compose down` — nada é perdido ao recriar os containers.
- O arquivo local `api-node/dados.json` (usado no `npm start`) não é mais
  montado no container; no Docker o banco é o volume.
- Para zerar o banco: `docker compose down -v` (remove volumes) ou
  `docker volume rm agendamento-fisioterapia-coffito_agendamento_dados`.
  No primeiro início após zerar, o seed recria o administrador inicial a
  partir das variáveis `ADMIN_*` do `.env`.

### 2. Apenas a API com Node.js

```bash
cd api-node
npm install
npm start
```

A API fica disponível em `http://localhost:3025/api/v1`.

### 3. Front-end em desenvolvimento

O front precisa ser servido por um servidor HTTP (não abra via `file://`,
pois os módulos ES não funcionam nesse protocolo). Exemplos:

```bash
cd front
python3 -m http.server 5500
```

Ou use a extensão **Live Server** do VS Code na pasta `front`.

Depois acesse:

- Página pública: `http://127.0.0.1:5500/index.html`
- Login: `http://127.0.0.1:5500/login.html`
- Painel: `http://127.0.0.1:5500/admin.html` (requer login)

Credenciais padrão do painel:

- E-mail: `admin@coffito.gov.br`
- Senha: `admin123`

## Regras principais

- Ao confirmar um agendamento, a vaga da sessão é decrementada.
- Ao remover um participante, a vaga volta a ficar disponível.
- Uma sessão sem vagas aparece como **Lotado** e não pode ser selecionada.
- Ao excluir um evento, os participantes vinculados também são removidos.
- Um profissional com sessões cadastradas não pode ser excluído.

## Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/v1/profissionais/buscar` | Lista/filtra profissionais |
| POST | `/api/v1/profissionais` | Cadastra profissional |
| PUT | `/api/v1/profissionais/atualizar/:id` | Atualiza profissional |
| DELETE | `/api/v1/profissionais/deletar/:id` | Remove profissional |
| GET | `/api/v1/sessoes/buscar` | Lista/filtra sessões |
| POST | `/api/v1/sessoes` | Cadastra sessão/evento |
| PUT | `/api/v1/sessoes/atualizar/:id` | Atualiza sessão |
| DELETE | `/api/v1/sessoes/delete/:id` | Remove sessão e participantes |
| GET | `/api/v1/participantes/buscar` | Lista/filtra participantes |
| POST | `/api/v1/participantes` | Inscreve participante |
| PUT | `/api/v1/participantes/atualizar/:id` | Atualiza participante |
| DELETE | `/api/v1/participantes/deletar/:id` | Remove participante |
| POST | `/api/v1/auth/login` | Realiza login e retorna token |
| GET | `/api/v1/auth/me` | Retorna o usuário autenticado (protegida) |
| GET | `/api/v1/auth/usuarios` | Lista administradores (protegida) |
| GET | `/api/v1/auth/usuarios/:id` | Busca um administrador (protegida) |
| PUT | `/api/v1/auth/usuarios/:id` | Atualiza administrador (protegida) |
| DELETE | `/api/v1/auth/usuarios/:id` | Exclui administrador (protegida) |
| POST | `/api/v1/administrador` | Cadastra administrador (protegida) |
| GET | `/api/v1/administrador/buscar` | Lista administradores (protegida) |
| PUT | `/api/v1/administrador/atualizar/:id` | Atualiza administrador (protegida) |
| DELETE | `/api/v1/administrador/deletar/:id` | Exclui administrador (protegida) |

## Persistência no Vercel (Vercel KV / Redis)

Em produção na Vercel o sistema de arquivos é efêmero, então o `dados.json`
não pode ser usado como banco. Quando as variáveis de ambiente do Vercel KV
estiverem configuradas, a API passa a persistir todo o JSON no Redis:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Basta criar um banco Vercel KV (ou integração Upstash Redis) no projeto e
conectar; as variáveis são injetadas automaticamente. Sem essas variáveis
(o desenvolvimento local, Docker e testes), a API continua usando o arquivo
JSON (`DATA_FILE`/`dados.json`).

## Testes

```bash
cd api-node
npm test
```
