# Rent Report — Admin

Internal admin dashboard for Rent Report. Separate app / separate repo, but it talks to the **same Supabase project** as the main `rent-report` app, so it shares auth and data. Access is restricted to users whose `profiles.is_admin = true`.

## Stack
React 18 + TypeScript + Vite + Tailwind + Zustand + Supabase JS. No PDF/maps/marketing deps — just the dashboard.

## Setup

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev            # http://localhost:5175
```

`.env` must point at the same Supabase project as the main app:

```
VITE_SUPABASE_URL=<same as main app>
VITE_SUPABASE_ANON_KEY=<same as main app>
```

For local dev against the local Supabase stack, use `http://localhost:54321` and the local anon key (same as the main app's `.env`).

## Auth & access control

- Sign in with **Google** or **email magic link / OTP** — the same Supabase auth as the main app.
- After sign-in the app loads the user's profile; if `is_admin` is not `true`, the dashboard shows a Forbidden screen.
- Server-side, every admin edge function (`admin-analytics`, `admin-metrics`, `admin-settings`) independently re-verifies the JWT **and** the `is_admin` flag, so the client gate is defense-in-depth, not the only check.

### Supabase redirect URLs
Add this app's callback to **Supabase → Authentication → URL Configuration → Redirect URLs**:
- `http://localhost:5175/callback` (local dev)
- `https://<your-admin-domain>/callback` (prod)

## Edge functions
The admin edge functions live in the **main `rent-report` repo** under `supabase/functions/` and are deployed to the shared Supabase project. This app only calls them over HTTPS — it does not contain or deploy them.

## Build
```bash
npm run build      # tsc + vite build → dist/
npm run preview
```

Deploy `dist/` as a static site (Netlify/Vercel/etc.) on an internal domain. Keep `noindex` (already set in `index.html`).
