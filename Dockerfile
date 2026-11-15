# TripBus — Frontend. Etapa 1 compila la app; etapa 2 la sirve con NGINX.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx/templates/ /etc/nginx/templates/
COPY --from=build /app/dist /usr/share/nginx/html

# Valores por defecto: nombres de servicio del docker-compose del repo API-gateway.
ENV FRONTEND_PORT=80 \
    API_GATEWAY_URL=http://api-gateway:8080 \
    REALTIME_URL=http://realtime-gateway:16007

EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:${FRONTEND_PORT}/salud || exit 1
