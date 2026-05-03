# MonkeyBeanGames

Daily Wordle + Crossword for Monkey Bean. Auto-generated content, passkey auth, PWA install.

## First-time setup

### 1. Env vars (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Content generator (Anthropic Claude)
ANTHROPIC_API_KEY=...

# Auth — used to sign session/challenge cookies. 32+ random chars.
AUTH_SECRET=...

# One-time secret she types when first enrolling her passkey.
# Defaults to "BEEPBOOP" if unset (dev only).
ENROLL_SECRET=...

# Token for /api/admin/generate (optional, only if you want HTTP gen).
ADMIN_TOKEN=...
```

### 2. Database migrations

In the Supabase SQL editor, run [`supabase/migrations/0001_passkeys.sql`](supabase/migrations/0001_passkeys.sql).
You also need the existing `experiences` and `progress` tables (already in use).

### 3. Profile

Edit [`lib/profile.ts`](lib/profile.ts) — fill in interests, pet names, places, inside jokes. The generator reads this.

## Generating content

```bash
npm run gen                                  # 7 days from today (Africa/Johannesburg)
npm run gen -- --days 30
npm run gen -- --start 2026-05-10 --days 14
npm run gen -- --days 1 --overwrite          # regen today
```

Existing dates are skipped unless `--overwrite`.

Or HTTP, with `ADMIN_TOKEN`:

```bash
curl -X POST -H "x-admin-token: $ADMIN_TOKEN" \
  "https://your-host/api/admin/generate?days=7"
```

## Auth

- First visit on a new device: **Set up a passkey** → enter `ENROLL_SECRET` → biometrics.
- Subsequent visits: **Sign in with passkey**.
- Session cookie lasts 90 days.

## PWA

Manifest at `/manifest.webmanifest`, service worker at `/sw.js` (production only). The install banner appears when the browser fires `beforeinstallprompt`. iOS: Share → Add to Home Screen.

## Dev

```bash
npm install
npm run dev
```
