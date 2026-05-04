# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências (apenas manifesto primeiro para cache eficiente)
COPY package*.json ./
RUN npm ci

# Copiar código-fonte e gerar Prisma client
COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Instalar apenas dependências de produção
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar artefatos de build e arquivos Prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

EXPOSE 3001

# Executar migrações e iniciar o servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
