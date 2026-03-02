# Nixpacks Node 22 is 22.11.x; Prisma 7 requires 22.12+. Pin exact version.
# Use full bookworm (not -slim) so Prisma gets OpenSSL libs it needs; slim was causing "Stopping Container" after migrate.
FROM node:22.12.0-bookworm AS base
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma/
COPY prisma.config.ts ./
# prisma generate only needs the schema; config still requires DATABASE_URL. Use a dummy at build time; Railway sets the real one at runtime.
ENV DATABASE_URL="postgresql://localhost:5432/dummy"
RUN npx prisma generate

COPY tsconfig.json ./
# Bust cache so Railway builds fresh (was serving stale code; no CORS/earlyLog in image)
ARG CACHEBUST=2
RUN echo "Rebuild: $CACHEBUST"
COPY src ./src/
RUN npm run build

ENV NODE_ENV=production
# Must match PORT Railway sets (e.g. 8080); EXPOSE 4000 caused proxy to forward to 4000 while app listened on 8080
EXPOSE 8080
COPY start.sh ./
RUN chmod +x start.sh
CMD ["./start.sh"]
