# ================================
# Stage 1: Build
# ================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (layer cache)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .

# Build args passed from docker-compose
ARG VITE_API_URL
ARG VITE_CF_TURNSTILE_SITE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_CF_TURNSTILE_SITE_KEY=$VITE_CF_TURNSTILE_SITE_KEY

RUN npm run build

# ================================
# Stage 2: Serve with nginx
# ================================
FROM nginx:1.27-alpine AS production

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
