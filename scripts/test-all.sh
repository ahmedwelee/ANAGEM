#!/usr/bin/env bash
# Runs every automated test suite of the project and prints one summary.
#
#   scripts/test-all.sh              everything: backend, frontend, end-to-end
#   scripts/test-all.sh backend      only the backend (unit + integration tests, coverage rule)
#   scripts/test-all.sh frontend     only the frontend (translations check, unit/component tests, production build)
#   scripts/test-all.sh e2e          only the browser tests (needs the production build; builds it if missing)
#   scripts/test-all.sh --fast       backend + frontend, without the browser tests
#
# Needs: Java 17+, Node 22+, Google Chrome (or E2E_CHANNEL=chromium after `npx playwright install chromium`). No Docker, no database.
set -uo pipefail
cd "$(dirname "$0")/.."

want="${1:-all}"
declare -a names=() results=() times=()
failed=0

run() { # run <name> <directory> <command...>
  local name="$1" dir="$2"; shift 2
  local start=$SECONDS
  printf '\n\033[1m▶ %s\033[0m\n' "$name"
  if (cd "$dir" && "$@"); then results+=("passed"); else results+=("FAILED"); failed=1; fi
  names+=("$name"); times+=("$((SECONDS - start))s")
}

install_if_missing() { [ -d "$1/node_modules" ] || (cd "$1" && npm ci); }

if [[ "$want" =~ ^(all|backend|--fast)$ ]]; then
  run "backend: unit + integration tests, coverage rule" backend ./mvnw -B -ntp verify
fi

if [[ "$want" =~ ^(all|frontend|--fast)$ ]]; then
  install_if_missing frontend
  run "frontend: translations are complete and used"      frontend bash -c 'npm run -s i18n && node scripts/check-i18n-usage.mjs'
  run "frontend: unit + component tests, coverage rule"    frontend npx ng test --no-watch --coverage
  run "frontend: production build (strict types, SSR)"     frontend npm run -s build
fi

if [[ "$want" =~ ^(all|e2e)$ ]]; then
  install_if_missing e2e
  [ -f frontend/dist/anagem-frontend/server/server.mjs ] || { install_if_missing frontend; run "frontend: production build (needed by the browser tests)" frontend npm run -s build; }
  run "end-to-end: real browser, real backend and database" e2e npx playwright test
fi

printf '\n\033[1mSummary\033[0m\n'
for i in "${!names[@]}"; do printf '  %-62s %-7s %s\n' "${names[$i]}" "${results[$i]}" "${times[$i]}"; done
[ "$failed" -eq 0 ] && printf '\n\033[32mAll suites passed.\033[0m\n' || printf '\n\033[31mSome suites failed.\033[0m\n'
exit "$failed"
