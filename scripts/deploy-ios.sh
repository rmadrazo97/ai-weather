#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Trigger an iOS production build + App Store Connect submission, unattended.
#
# Prereqs (one-time, already done — see DEPLOYMENT.md):
#   - Logged in to EAS (`eas login`) — the machine has the session.
#   - Distribution Certificate + provisioning profiles for both targets
#     (com.myweatherai.app and com.myweatherai.app.widgets) exist on EAS.
#   - secrets/eas-credentials.env + secrets/AuthKey_*.p8 present (gitignored).
#
# No password / 2FA: Apple auth uses the App Store Connect API key. Nothing
# sensitive is committed — the key id/issuer are injected into eas.json only for
# the duration of this run and restored on exit, so the public repo stays clean.
#
# Usage:  ./scripts/deploy-ios.sh
# Bump the marketing version in app.json first if this is a new App Store version
# (build number auto-increments on EAS).
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="secrets/eas-credentials.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: missing $ENV_FILE — see DEPLOYMENT.md (secrets are gitignored)." >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"
export EAS_BUILD_NO_EXPO_GO_WARNING=true

EAS="$(command -v eas >/dev/null 2>&1 && echo eas || echo 'npx eas-cli@latest')"

# Inject the ASC API key into eas.json transiently (restored on exit) so the
# Key ID / Issuer ID are never committed to this public repo.
cp eas.json eas.json.deploybak
restore() { mv -f eas.json.deploybak eas.json; }
trap restore EXIT
python3 - "$EXPO_ASC_API_KEY_PATH" "$EXPO_ASC_KEY_ID" "$EXPO_ASC_ISSUER_ID" <<'PY'
import json, sys
path, key_id, issuer = sys.argv[1:4]
cfg = json.load(open("eas.json"))
ios = cfg["submit"]["production"]["ios"]
ios["ascApiKeyPath"], ios["ascApiKeyId"], ios["ascApiKeyIssuerId"] = path, key_id, issuer
json.dump(cfg, open("eas.json", "w"), indent=2)
PY

echo "▸ Queuing iOS production build + auto-submit (widget included)…"
# shellcheck disable=SC2086
$EAS build \
  --platform ios \
  --profile production \
  --auto-submit \
  --non-interactive \
  --no-wait

echo "▸ Done. Track at https://expo.dev/accounts/jmadrazo7/projects/ai-weather/builds"
echo "  After it processes, attach the build to the version in App Store Connect"
echo "  and Submit for Review (public release)."
