# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# We only need the build output; compose mounts it into nginx via a volume
FROM alpine:3.20
# dummy final stage because compose uses the "frontend" container only to populate the volume
