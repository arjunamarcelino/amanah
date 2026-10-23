#!/usr/bin/env bash
# Deploy the stack to the VPS: ssh in, pull, rebuild, and bring everything up.
#
#   VPS_HOST=user@amanah.help ./scripts/deploy.sh
#   VPS_HOST=user@1.2.3.4 VPS_PATH=/srv/amanah VPS_BRANCH=main ./scripts/deploy.sh
#
# ALWAYS rebuilds (`--build`): NEXT_PUBLIC_* are inlined into the web/landing images at
# build time, so a plain restart would keep stale values. The one-shot `migrate` service
# runs `prisma migrate deploy` before api/indexer start; if it fails, api/indexer never
# start (depends_on service_completed_successfully) and this script exits non-zero.
#
# Migrate recovery: a migration that fails mid-apply marks _prisma_migrations failed and
# every later deploy aborts with P3009 until you run, on the VPS:
#   docker compose run --rm migrate pnpm --filter @amanah/db exec prisma migrate resolve --applied <name>
set -euo pipefail

: "${VPS_HOST:?set VPS_HOST=user@host}"
VPS_PATH="${VPS_PATH:-/srv/amanah}"
VPS_BRANCH="${VPS_BRANCH:-main}"

echo "==> Deploying to ${VPS_HOST} (${VPS_PATH}, branch ${VPS_BRANCH})"

ssh "$VPS_HOST" bash -s <<EOF
set -euo pipefail
cd "${VPS_PATH}"
echo "==> git pull"
git fetch origin "${VPS_BRANCH}"
git checkout "${VPS_BRANCH}"
git pull --ff-only origin "${VPS_BRANCH}"

echo "==> docker compose up -d --build"
docker compose up -d --build

# Surface the one-shot migrate result explicitly (compose up does not fail the command
# if a dependency one-shot exits non-zero in all versions).
migrate_rc=\$(docker compose ps -a --format '{{.Service}} {{.ExitCode}}' | awk '\$1=="migrate"{print \$2}')
if [ -n "\${migrate_rc:-}" ] && [ "\${migrate_rc}" != "0" ]; then
  echo "ERROR: migrate exited \${migrate_rc} — see 'docker compose logs migrate' (P3009? run prisma migrate resolve)" >&2
  exit 1
fi

echo "==> docker compose ps"
docker compose ps
EOF

echo "==> Deploy complete. Verify TLS + headers:  curl -I https://app.amanah.help"
