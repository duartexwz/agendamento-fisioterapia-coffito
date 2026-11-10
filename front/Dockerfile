FROM nginx:alpine

COPY . /usr/share/nginx/html

# Proxy de /api/v1 para a API (serviço "api" do docker-compose).
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 65

CMD ["nginx", "-g", "daemon off;"]