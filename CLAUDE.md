# Rent Report Admin — Claude Code Context

Internal admin dashboard for Rent Report. **Separate app, separate git repo**, but it
talks to the **same Supabase project** as the main `rent-report` app (sibling directory
`../rent-report`), so it shares auth and data. Access is restricted to users whose
`profiles.is_admin = true`.

> ⚠️ **Edge functions for this app live in the sibling `../rent-report` repo, NOT here.**
> If any admin API behavior needs to change (analytics queries, metrics, settings writes, auth
> checks), edit and deploy the function in **`../rent-report/supabase/functions/`**
> (`admin-analytics`, `admin-metrics`, `admin-settings`). This repo is **frontend-only** — it has
> no `supabase/` directory and never deploys functions, migrations, or config. See below.

## Relationship to the main app

- **Same Supabase project** — same auth, same `profiles`/analytics tables.
- **Admin edge functions live in the MAIN repo**, not here: `admin-analytics`, `admin-metrics`,
  `admin-settings` under `../rent-report/supabase/functions/`. This app only *calls* them over
  HTTPS (with the signed-in user's JWT). Do NOT recreate or deploy them from here.
- Some client code is **duplicated** from the main app (copied, not shared): `authStore.ts`,
  `lib/supabase.ts`, `lib/adminApi.ts`, `lib/adminAnalyticsApi.ts`. If you change auth or the
  admin API contracts, they may need to change in both repos. (A shared package could fix this
  later; not done yet.)

## Stack

React 18 + TypeScript + Vite + Tailwind + Zustand + `@supabase/supabase-js`. No PDF/maps/
marketing deps — just the dashboard. **Dev port 5175** (main app is 5174, so both run at once).

## What's needed to run it

1. `cp .env.example .env` and set both values to the **same Supabase project** as the main app:
   ```
   VITE_SUPABASE_URL=<local http://localhost:54321  OR  hosted https://<ref>.supabase.co>
   VITE_SUPABASE_ANON_KEY=<matching anon key>
   ```
2. Add this app's callback to **Supabase → Authentication → URL Configuration → Redirect URLs**:
   - `http://localhost:5175/callback` (local dev)
   - `https://<prod-admin-domain>/callback` (prod)
   Google sign-in bounces without this.
3. Ensure the admin edge functions are deployed to that Supabase project (from the main repo).
4. Your account must have `profiles.is_admin = true`.
5. `npm install` → `npm run dev` → http://localhost:5175

## Auth & access control

- **Google sign-in only.** (Email magic-link/OTP was removed — the main app still has it.)
- Flow: `/login` (Google) → Supabase OAuth → `/callback` (establishes session) → `/`.
- `App.tsx` gates `/` behind an authenticated session (`RequireAuth`); `AdminDashboard` itself
  shows a **Forbidden** screen when `profile.is_admin` is not true.
- Server-side, every admin edge function independently re-verifies the JWT **and** `is_admin`, so
  the client gate is defense-in-depth, not the only check. Keep it that way.

## Key files

| File | Purpose |
|---|---|
| `src/App.tsx` | Routes + `RequireAuth` session gate |
| `src/components/Login.tsx` | Google-only sign-in page |
| `src/components/Callback.tsx` | Establishes session, routes to `/` |
| `src/components/AdminHeader.tsx` | 64px top bar + sign out (dashboard assumes `100vh-64px`) |
| `src/components/AdminDashboard.tsx` | The dashboard (copied from main app; `is_admin` guard inside) |
| `src/stores/authStore.ts` | Google login / logout / session (copied from main app) |
| `src/stores/profileStore.ts` | Trimmed profile store — just the `is_admin` gate |
| `src/lib/adminApi.ts`, `adminAnalyticsApi.ts` | Fetch clients for the admin edge functions |

## Build & deploy

- `npm run build` → `tsc && vite build` → `dist/`
- Deploy `dist/` as a static site on an internal domain. `index.html` already has `noindex`.
- No GitHub remote is set up yet (initial commit exists locally). Create one when ready.

## Conventions (inherited from main app)

- Never grant anon/public direct table SELECT — all data goes through the admin edge functions
  (which use service role + verify `is_admin`).
- Don't expose the Supabase service key to the browser — this app only uses the anon key + the
  user's JWT.
