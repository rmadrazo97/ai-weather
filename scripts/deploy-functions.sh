#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Deploy the Firebase Cloud Functions backend (the `weatherChat` LangGraph
# agent). Required whenever functions/src changes — e.g. the agent system
# prompt (language / formatting behaviour).
#
# Prereq: `firebase login` once (interactive). The predeploy hook in
# firebase.json compiles TypeScript (`npm --prefix functions run build`).
#
# Usage:  ./scripts/deploy-functions.sh
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

FIREBASE="$(command -v firebase >/dev/null 2>&1 && echo firebase || echo 'npx firebase-tools@latest')"

echo "▸ Deploying Cloud Functions…"
$FIREBASE deploy --only functions
