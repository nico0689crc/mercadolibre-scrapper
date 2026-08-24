# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app
ENV CI=true

# ---- dependencias (todas, incluidas dev) ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- desarrollo: hot reload, el codigo entra por bind mount ----
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 4100
CMD ["npm", "run", "start:dev"]

# ---- build de produccion ----
FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime de produccion ----
FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4100}/api/health" || exit 1
CMD ["node", "dist/main.js"]
