# Builder image
FROM node:24-bookworm-slim AS builder
WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code and Prisma schema
COPY . .

# Generate Prisma client (required for this project)
RUN pnpm prisma generate

# Build the application
RUN pnpm build

# Runner image
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Install system dependencies and create non-root user
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/* && \
    useradd -m -u 10001 nextjs-user

# Enable corepack for pnpm
RUN corepack enable

# Copy built application files
COPY --from=builder --chown=appuser:appuser /app/.next/standalone ./
COPY --from=builder --chown=appuser:appuser /app/.next/static ./.next/static
COPY --from=builder --chown=appuser:appuser /app/public ./public

# Copy Prisma files for potential migrations in production
COPY --from=builder --chown=appuser:appuser /app/prisma ./prisma
COPY --from=builder --chown=appuser:appuser /app/package.json ./package.json

USER nextjs-user

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD ["sh", "-c", "curl -f http://localhost:3000/api/health || curl -f http://localhost:3000/ || exit 1"]
CMD ["node", "server.js"]