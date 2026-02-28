# Nixpacks Node 22 is 22.11.x; Prisma 7 requires 22.12+. Pin exact version.
FROM node:22.12.0-bookworm-slim AS base
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
