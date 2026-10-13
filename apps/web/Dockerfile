FROM node:22-alpine AS deps
WORKDIR /repo/apps/web
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY apps/web/package.json apps/web/pnpm-lock.yaml* ./
RUN pnpm install --no-frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /repo/apps/web
RUN corepack enable && corepack prepare pnpm@9 --activate
ARG NEXT_PUBLIC_API_BASE_URL=
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo/apps/web/node_modules ./node_modules
COPY . /repo
RUN pnpm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=7777 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./public
USER nextjs
EXPOSE 7777
CMD ["node", "apps/web/server.js"]
