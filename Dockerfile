# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

# NODE_ENV must NOT be set to production here: npm would then skip the
# devDependencies, and the build needs them (@tailwindcss/postcss is required by
# postcss.config.mjs). `next build` produces a production build regardless.

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
COPY packages/apowerb-sdk/package.json ./packages/apowerb-sdk/package.json

RUN npm ci --ignore-scripts

COPY . .

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
# Next.js standalone binds to process.env.HOSTNAME, and Docker injects HOSTNAME
# into every container (the container id, or the host name with --network host).
# Left unpinned, the server binds to that single interface only, so localhost and
# health checks inside the container are refused. Pin it to every interface.
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
