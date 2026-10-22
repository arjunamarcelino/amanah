# syntax=docker/dockerfile:1
# @amanah/landing — static Next.js export served by Caddy. Skeleton.
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# next/font/local reads the committed .woff2 files, so this build needs no network.
RUN pnpm --filter @amanah/landing... build

FROM caddy:2-alpine AS run
COPY --from=build /app/apps/landing/out /srv
# Caddyfile-driven static server: branded 404, compression, and cache headers.
# (Security/response headers for the public edge live in docker/Caddyfile.)
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

	# Serve the static export's branded 404 page on unknown paths. The handle_errors
	# block runs with the original error status set, so the served page keeps its 404
	# (not a soft-404 / 200); non-404 errors fall back to a plain status response.
	# NOTE: Caddy is not run in CI here — verify on first deploy that
	# `curl -I https://amanah.help/does-not-exist` returns `HTTP/2 404`.
	handle_errors {
		@404 expression {err.status_code} == 404
		handle @404 {
			rewrite * /404.html
			file_server
		}
		handle {
			respond "{err.status_code} {err.status_text}" {err.status_code}
		}
	}
}
CADDYFILE
EXPOSE 80
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
