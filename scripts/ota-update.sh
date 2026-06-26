#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Publish an over-the-air (OTA) JavaScript update to the production channel.
#
# Use this for JS/TS-only changes (UI, logic, copy) to push fixes to users
# WITHOUT an App Store review. It does NOT ship native changes — new widgets,
# native modules, app.json/plugin/entitlement changes, or icon/splash require a
# full build via scripts/deploy-ios.sh and App Store review.
#
# runtimeVersion uses the "fingerprint" policy, so an OTA update only reaches
# installed builds whose native fingerprint matches the one it was published
# from. If you changed native code, OTA won't reach old builds — do a full build.
#
# Usage:  ./scripts/ota-update.sh "what changed"
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

MSG="${1:-OTA update}"
EAS="$(command -v eas >/dev/null 2>&1 && echo eas || echo 'npx eas-cli@latest')"

echo "▸ Publishing OTA update to production channel: $MSG"
$EAS update --branch production --message "$MSG" --non-interactive
