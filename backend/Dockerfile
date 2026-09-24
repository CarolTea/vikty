# VicTy backend — Dockerfile
# Stack: Node.js 22 + TypeScript + Fastify.
# Contract the backend app must honor for this file to work:
#   - `npm run build` emits JS into ./dist
#   - `node dist/index.js` starts the HTTP server on $PORT
#   - GET /health returns 200 when the process is up

# ---------- deps: install everything needed to build ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---------- build: compile TypeScript ----------
FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

# ---------- runtime: minimal image, non-root ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" > /dev/null || exit 1

# Secrets (JUPITER_API_KEY, AI_API_KEY, DATABASE_URL...) come from the runtime environment,
# never baked into the image.
CMD ["node", "dist/index.js"]
