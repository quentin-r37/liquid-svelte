# syntax=docker/dockerfile:1

# ─── Build ────────────────────────────────────────────────────────────────────
# Node 22 : vite 8 exige >= 20.19 / 22.12, et 20-alpine sort du support en 2026.
FROM node:22-alpine AS builder

WORKDIR /app

# Les dépendances d'abord : cette couche n'est réinvalidée que si le manifeste
# ou le lockfile change, pas à chaque commit de source.
COPY package.json package-lock.json ./

# `npm ci` (et non `install`) pour respecter le lockfile. Le script `prepare`
# lance `svelte-kit sync`, qui a besoin de .svelte-kit/ — inoffensif ici puisque
# les sources ne sont pas encore copiées, il est relancé par le build.
RUN npm ci

COPY . .

# Coolify injecte le SHA du commit déployé. Rien ne le lit aujourd'hui, mais il
# reste disponible au build si une route veut l'afficher un jour.
ARG SOURCE_COMMIT
ENV SOURCE_COMMIT=${SOURCE_COMMIT}

RUN npm run build

# adapter-node produit un `build/` autonome ; on ne garde que les dépendances de
# production pour la copie vers l'image finale.
RUN npm prune --omit=dev

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# adapter-node lit PORT/HOST au démarrage ; 0.0.0.0 est obligatoire pour que le
# proxy de Coolify atteigne le conteneur.
ENV PORT=3000
ENV HOST=0.0.0.0
# Décommenter et pointer sur le domaine public si des form actions sont ajoutées
# — sans ORIGIN, SvelteKit rejette les POST cross-origin derrière un proxy.
# ENV ORIGIN=https://liquid-svelte.example.com

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# busybox fournit wget ; pas de curl dans l'image alpine.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD wget --quiet --spider http://127.0.0.1:3000/ || exit 1

USER node

CMD ["node", "build"]
