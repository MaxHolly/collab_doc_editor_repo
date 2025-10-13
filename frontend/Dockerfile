FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM alpine:3.20
RUN mkdir -p /usr/share/nginx/html
COPY --from=build /app/dist /usr/share/nginx/html