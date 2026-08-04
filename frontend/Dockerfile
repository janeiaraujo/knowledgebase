# Imagem do frontend: compila com Node, serve com nginx.
#
# O resultado do build e HTML/CSS/JS estatico - nao ha motivo para carregar o
# Node em producao so para servir arquivo. A imagem final e nginx-alpine com o
# conteudo de dist/.

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Caminhos relativos: o nginx desta mesma imagem faz o proxy de /api e /ws para
# o backend, entao o navegador nunca precisa saber o endereco dele.
ENV VITE_API_URL=/api
RUN npm run build


FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
