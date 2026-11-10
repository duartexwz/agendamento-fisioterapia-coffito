FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Diretório do banco de dados persistente (volume nomeado no compose).
RUN mkdir -p /app/data

ENV PORT=3025

EXPOSE 3025

CMD ["npm", "start"]