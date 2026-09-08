# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Multi-stage build API Gateway.
#
# builder : install SEMUA dependency (dev + prod) & compile TypeScript → dist.
# runner  : copy hasil build + HANYA dependency production (npm ci --omit=dev).
# Hasil image akhir hanya berisi dist + node_modules production → kecil & aman.
# ---------------------------------------------------------------------------

# ---------- BUILDER ----------
FROM node:24-alpine AS builder
WORKDIR /app

# Salin manifest dependency dulu (bukan source) supaya layer `npm ci`
# bisa di-cache selama package.json/package-lock.json tidak berubah.
COPY package.json package-lock.json ./
RUN npm ci

# Salin tsconfig + source, lalu build TypeScript ke ./dist.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------- RUNNER (production) ----------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Nilai awal PORT — bisa dioverride saat runtime via `-e PORT=...` / compose env.
ENV PORT=5000

# Install HANYA dependency production (tetap dari lockfile → reproducible).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy hasil build TypeScript dari stage builder (bukan source).
COPY --from=builder /app/dist ./dist

# EXPOSE hanya metadata/dokumentasi — tidak mengikat port.
# Docker tidak bisa membaca ENV runtime untuk EXPOSE, jadi port dideklarasikan
# lewat build arg (default 5000). Yang sebenarnya menentukan port app mendengar
# adalah env PORT yang dibaca app.listen(env.PORT) saat container dijalankan.
ARG PORT=5000
EXPOSE ${PORT}

# Jalankan hasil build (dist), bukan source/tsx.
CMD ["node", "dist/index.js"]