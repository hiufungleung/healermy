# Builder image
FROM node:24-alpine AS builder
WORKDIR /app

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

# Copy package files
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Runner image
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    ACCESS_TYPE=offline \
    PATIENT_SCOPE_OFFLINE="launch/encounter launch/patient openid profile offline_access launch fhirUser user/*:* patient/*:*" \
    PATIENT_SCOPE_ONLINE="launch/encounter launch/patient openid profile online_access launch fhirUser user/*:* patient/*:*" \
    PROVIDER_SCOPE_OFFLINE="launch/encounter launch/patient openid profile offline_access launch fhirUser user/*:* patient/*:*" \
    PROVIDER_SCOPE_ONLINE="launch/encounter launch/patient openid profile online_access launch fhirUser user/*:* patient/*:*" \
    SESSION_EXPIRY=90d
# (Other environment variables like CLIENT_ID, CLIENT_SECRET, SESSION_SECRET, SESSION_SALT should be provided at runtime)

# Install curl for health checks and create non-root user
RUN apk add --no-cache curl && \
    addgroup -g 10001 -S nextjs && \
    adduser -S nextjs -u 10001 -G nextjs

# Enable corepack for pnpm
RUN corepack enable

# Copy built application files
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

USER nextjs

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD ["sh", "-c", "curl -f http://localhost:3000/api/health-check || exit 1"]
CMD ["node", "server.js"]
