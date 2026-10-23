# syntax=docker/dockerfile:1
# @amanah/landing — static Next.js export (output: 'export') served by Caddy.
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.29.2 --activate
WORKDIR /app

FROM base AS prune
RUN pnpm add -g turbo@2.11.9
COPY . .
RUN turbo prune @amanah/landing --docker

FROM base AS installer
COPY --from=prune /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM installer AS builder
# NEXT_PUBLIC_APP_URL is build-time inlined (lib/site.ts throws if not http(s)).
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
COPY --from=prune /app/out/full/ .
# next/font/local reads the committed .woff2 files, so this build needs no network.
RUN pnpm turbo run build --filter=@amanah/landing

# runner: caddy:2-alpine static server — branded 404, compression, cache headers.
# (Security/response headers for the public edge live in docker/Caddyfile.)
FROM caddy:2-alpine AS runner
COPY --from=builder /app/apps/landing/out /srv
COPY <<'CADDYFILE' /etc/caddy/Caddyfile
:80 {
	root * /srv
	encode zstd gzip

	# Content-hashed assets never change: cache them hard.
	@static {
		path /_next/static/* *.css *.js *.mjs *.woff *.woff2 *.ttf *.otf *.png *.jpg *.jpeg *.gif *.svg *.webp *.avif *.ico
	}

	# HTML (and anything not matched above) must revalidate so deploys land at once.
	header Cache-Control "public, max-age=0, must-revalidate"
	header @static Cache-Control "public, max-age=31536000, immutable"

	file_server

	# Serve the static export's branded 404 page on unknown paths. `file_server { status 404 }`
	# forces a real 404 on the served page (not a soft-404 / 200); non-404 errors fall back to
	# a plain status response. Validated with `caddy validate` (caddy 2.9).
	handle_errors {
		@404 expression {err.status_code} == 404
		handle @404 {
			rewrite * /404.html
			file_server {
				status 404
			}
		}
		handle {
			respond "{err.status_code} {err.status_text}" {err.status_code}
		}
	}
}
CADDYFILE
EXPOSE 80
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
