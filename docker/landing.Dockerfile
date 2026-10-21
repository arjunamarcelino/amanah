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

	# Serve the static export's branded 404 page on unknown paths.
	handle_errors {
		rewrite * /404.html
		file_server
	}
}
CADDYFILE
EXPOSE 80
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
