# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time provider configuration (empty args fall back to code defaults)
ARG VITE_JOBS_DATA_URL
ARG VITE_SUBMIT_COMPANY_URL
ENV VITE_JOBS_DATA_URL=$VITE_JOBS_DATA_URL
ENV VITE_SUBMIT_COMPANY_URL=$VITE_SUBMIT_COMPANY_URL
# Optional read-only deploy key for the private logo assets repo (see
# scripts/pull_logos.mjs). Empty/unset: build keeps letter avatars.
ARG LOGOS_DEPLOY_KEY

# git + ssh are needed by the optional logo pull
RUN apk add --no-cache git openssh-client

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN LOGOS_DEPLOY_KEY="$LOGOS_DEPLOY_KEY" npm run build

# Production stage - serve with nginx
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
