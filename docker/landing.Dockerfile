# syntax=docker/dockerfile:1
# @amanah/landing — static Next.js export served by Caddy. Skeleton.
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @amanah/landing... build

FROM caddy:2-alpine AS run
COPY --from=build /app/apps/landing/out /srv
EXPOSE 80
CMD ["caddy", "file-server", "--root", "/srv", "--listen", ":80"]
