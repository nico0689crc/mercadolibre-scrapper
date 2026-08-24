# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app
ENV CI=true NEXT_TELEMETRY_DISABLED=1

# ---- dependencias ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- desarrollo: hot reload, el codigo entra por bind mount ----
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3100
CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]

# ---- build de produccion (output: standalone) ----
FROM base AS build
ENV NODE_ENV=production
# NEXT_PUBLIC_* se inlinea en el bundle del browser: tiene que existir en build.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runtime de produccion ----
FROM base AS production
ENV NODE_ENV=production PORT=3100 HOSTNAME=0.0.0.0
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3100}/" >/dev/null || exit 1
CMD ["node", "server.js"]
