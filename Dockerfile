# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

ENV NODE_ENV=production

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

COPY --from=builder /app/public ./public
COPY --from=builder /app/messages ./messages
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
