# Combined Dockerfile - Frontend served by Backend (no nginx)

# ============ Build Frontend ============
FROM node:20-alpine AS frontend-builder

# Build args for Vite environment variables
ARG VITE_PUBLIC_POSTHOG_KEY
ARG VITE_PUBLIC_POSTHOG_HOST
ARG VITE_ADSENSE_CLIENT_ID
ARG VITE_ADSENSE_SLOT_BANNER
ARG VITE_JOBS_DATA_URL
ARG VITE_SUBMIT_COMPANY_URL
# Optional read-only deploy key for the private logo assets repo (see
# frontend/scripts/pull_logos.mjs). Empty/unset: build keeps letter avatars.
ARG LOGOS_DEPLOY_KEY

# git + ssh are needed by the optional logo pull
RUN apk add --no-cache git openssh-client

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./

# Pass build args as env vars for Vite build
ENV VITE_PUBLIC_POSTHOG_KEY=$VITE_PUBLIC_POSTHOG_KEY
ENV VITE_PUBLIC_POSTHOG_HOST=$VITE_PUBLIC_POSTHOG_HOST
ENV VITE_ADSENSE_CLIENT_ID=$VITE_ADSENSE_CLIENT_ID
ENV VITE_ADSENSE_SLOT_BANNER=$VITE_ADSENSE_SLOT_BANNER
ENV VITE_JOBS_DATA_URL=$VITE_JOBS_DATA_URL
ENV VITE_SUBMIT_COMPANY_URL=$VITE_SUBMIT_COMPANY_URL

RUN LOGOS_DEPLOY_KEY="$LOGOS_DEPLOY_KEY" npm run build

# ============ Build Backend ============
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ============ Production ============
FROM node:20-alpine

RUN apk add --no-cache python3 make g++
WORKDIR /app

# Backend dependencies
COPY backend/package*.json ./
RUN npm ci --only=production && npm rebuild better-sqlite3

# Clean build tools
RUN apk del python3 make g++ && rm -rf /root/.npm /tmp/*

# Copy backend build
COPY --from=backend-builder /app/backend/dist ./dist

# Copy frontend build to public folder
COPY --from=frontend-builder /app/frontend/dist ./public

# Create data directory
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DB_PATH=/app/data/techjobs.db

EXPOSE 3001

CMD ["node", "dist/index.js"]
