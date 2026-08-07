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
# Next's standalone `server.js` binds to whatever HOSTNAME says. Unset, it
# resolves the container's own hostname, which is an address that exists only
# inside the container's network namespace: `docker run -p 3000:3000` then
# forwards to a port nothing is listening on, and the site answers
# "connection refused" while the container looks perfectly healthy.
#
# Every self-hosted deployment hits this and every one has to discover the
# same variable. Reported from a real install on 2026-08-07 -- setting it by
# hand fixed it, so it belongs in the image rather than in each operator's
# notes. Override it if you deliberately want a narrower bind.
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
