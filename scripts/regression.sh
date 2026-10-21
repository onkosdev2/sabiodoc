#!/usr/bin/env bash
# Regresión local de SabioDoc.
#
# Uso:
#   ./scripts/regression.sh
#   VERIFY_PROD=1 ./scripts/regression.sh
#   AUDIT_A11Y=1 CHROME_PATH=/snap/bin/chromium ./scripts/regression.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON="${PYTHON:-$ROOT/apps/api/venv/bin/python}"

echo "== Backend: migraciones y tests =="
(
  cd "$ROOT/apps/api"
  "$PYTHON" -m alembic check
  "$PYTHON" -m pytest app/tests -q
)

echo "== Frontend: lint, tipos, tests y build =="
(
  cd "$ROOT/apps/web"
  npm run lint
  npx tsc --noEmit
  npm test
  npm run build
)

if [[ "${AUDIT_A11Y:-0}" == "1" ]]; then
  echo "== Accesibilidad: axe-core =="
  (
    cd "$ROOT/apps/web"
    node scripts/audit-a11y.mjs
  )
fi

if [[ "${VERIFY_PROD:-0}" == "1" ]]; then
  echo "== Producción: verificación =="
  (
    cd "$ROOT/apps/web"
    node scripts/verify-production.mjs
  )
fi

echo
echo "Regresión automática completada."
echo "Pendiente manual: docs/regresion-6-1-6-2.md"
echo "- Videollamada con dos usuarios (bloqueada hasta Jitsi self-hosted)."
echo "- Evidencias en docs/evidencias/AAAA-MM-DD/."
