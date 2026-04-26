#!/bin/bash
set -euo pipefail

# Only run in remote (web) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Install dependencies if node_modules is missing or package-lock.json changed
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  echo "Installing npm dependencies..."
  npm install
else
  echo "node_modules up to date, skipping install."
fi
