# Deployment

How to build, ship, and update **AI Weather** (Expo SDK 56 / EAS / Firebase).
The goal: anyone (including an automation agent) can trigger a release
non-interactively, with **no Apple password/2FA** and **no secrets in this
public repo**.

---

## TL;DR — what to run

| You changed… | Run | Reaches users via |
|---|---|---|
| JS/TS only (UI, logic, copy) | `./scripts/ota-update.sh "msg"` | OTA, instant, no review |
| Native (widget, deps, app.json, icons, entitlements) | bump `version` in `app.json`, then `./scripts/deploy-ios.sh` | App Store build + review |
| AI agent (`functions/src/**`) | `./scripts/deploy-functions.sh` | Firebase backend, instant |

> The fix that prompted v1.0.1 (live clock, foreground refresh, hero overlap,
> AI language) is JS-only **except** it ships in the same build that first
> includes the WidgetKit extension, so it went out as a full build.

---

## Architecture (what gets deployed where)

- **App binary (iOS)** — Expo app + **WidgetKit extension**. The widget is a
  config-plugin target (`@bacons/apple-targets`, see `targets/widgets/`), so it
  is regenerated on every EAS prebuild — it ships automatically with the iOS
  build. Bundle ids: app `com.myweatherai.app`, widget `com.myweatherai.app.widgets`,
  shared App Group `group.com.myweatherai.app`.
- **OTA JS bundle** — `expo-updates`, channel `production`,
  `runtimeVersion.policy = "fingerprint"`. Delivers JS-only changes to matching
  builds without review.
- **Backend** — Firebase Cloud Functions in `functions/` (the `weatherChat`
  LangGraph agent). Independent of the app binary; deploy separately.

---

## Secrets (never committed — `secrets/` is gitignored)

| File | What | How to recreate |
|---|---|---|
| `secrets/AuthKey_<KEY_ID>.p8` | App Store Connect API key (private) | App Store Connect → Users and Access → Integrations → App Store Connect API → generate (Admin). Download once. |
| `secrets/eas-credentials.env` | `EXPO_ASC_*` + `EXPO_APPLE_TEAM_ID` exports | Template below |
| `secrets/play-service-account.json` | Google Play service account (Android submit) | Play Console → API access |

`secrets/eas-credentials.env`:

```bash
export EXPO_ASC_API_KEY_PATH="./secrets/AuthKey_<KEY_ID>.p8"
export EXPO_ASC_KEY_ID="<KEY_ID>"            # = the AuthKey_<ID>.p8 filename
export EXPO_ASC_ISSUER_ID="<issuer-uuid>"      # ASC → Integrations page header
export EXPO_APPLE_TEAM_ID="<TEAM_ID>"         # Individual team
```

Only the `.p8` is a true secret. The Key ID / Issuer ID / Team ID are account
identifiers (useless without the `.p8`) but are kept out of the repo anyway.
`scripts/deploy-ios.sh` injects them into `eas.json` only for the duration of a
run and restores the file on exit, so the committed `eas.json` stays clean.

---

## iOS App Store release — `./scripts/deploy-ios.sh`

1. If this is a new App Store version, bump `expo.version` in `app.json`
   (e.g. `1.0.1` → `1.0.2`). The build number auto-increments on EAS
   (`eas.json` → `cli.appVersionSource: "remote"` + `build.production.autoIncrement`).
2. Run `./scripts/deploy-ios.sh`. It:
   - sources `secrets/eas-credentials.env` (API-key auth → no password/2FA),
   - queues `eas build -p ios --profile production --auto-submit --non-interactive --no-wait`,
   - the cloud build runs ~15–25 min, then **auto-submits** the binary to
     App Store Connect (app id `6779910676`).
3. In **App Store Connect**, attach the processed build to the version and hit
   **Submit for Review** (the API key uploads the binary; the public-release
   submit is a manual click).

### Why a real terminal was needed once (and isn't anymore)

EAS will not *create* a first-ever Distribution Certificate without an
interactive TTY (a CI safety guard). That one-time setup was done in Terminal.app
and the cert + both provisioning profiles now live on EAS. Every build after
that — including from CI or an agent shell — works with `--non-interactive`.
If you ever need to regenerate credentials, run `eas credentials -p ios` in a
real terminal with `secrets/eas-credentials.env` sourced (still no password).

---

## Backend (AI agent) — `./scripts/deploy-functions.sh`

Deploys `functions/` (TypeScript compiled by the predeploy hook). Needed for any
change to the agent, e.g. the system prompt in `functions/src/agent.ts`
(reply-in-user-language, no-markdown). Requires `firebase login` once.

---

## OTA JS update — `./scripts/ota-update.sh "message"`

Pushes a JS-only bundle to the `production` channel instantly, no review. Does
**not** ship native changes. Because `runtimeVersion` is `fingerprint`, an OTA
only reaches builds with a matching native fingerprint — if you touched native
code, do a full build instead.

---

## Android (optional, no widgets)

Configured but secondary. `eas build -p android --profile production --auto-submit`
submits to the Play **internal** track (`eas.json` → `submit.production.android`,
needs `secrets/play-service-account.json`). There is no Android widget target.

---

## Quotas / cost

- EAS Build minutes are billed per build — prefer OTA for JS-only fixes.
- Apple allows max 2 Distribution Certificates; EAS reuses the existing one.
- Gemini (chat backend) needs prepaid credits or the agent degrades to the
  local keyword fallback in `src/utils/localAnswers.ts`.
