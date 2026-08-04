# Imagem do backend.
#
# Multi-stage para as dependencias de producao ficarem separadas das de
# desenvolvimento: a imagem final nao carrega eslint, nem o runner de testes,
# nem o cache do npm.

FROM node:22-alpine AS deps

WORKDIR /app

# Copia so os manifestos primeiro: enquanto eles nao mudarem, o Docker
# reaproveita esta camada e nao reinstala nada a cada alteracao de codigo.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev


FROM node:22-alpine AS runtime

# Roda como usuario sem privilegio. A imagem node ja traz o usuario `node`.
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node scripts ./scripts

# Diretorio de upload local (fallback do R2) precisa existir e ser gravavel.
RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node

EXPOSE 3000

# O compose ja tem healthcheck, mas quem roda a imagem solta tambem precisa.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
    CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
