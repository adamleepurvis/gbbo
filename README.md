# Bake Off Fantasy

A fantasy prediction pool for The Great British Bake Off. Each week, players pick:

- Whether there'll be a Hollywood Handshake (yes/no), and if yes, who gets it
- First place in Technical
- Last place in Technical
- Star Baker
- Who gets eliminated

**Scoring:** each correct pick is worth +1 point. Guessing the handshake yes/no wrong is -1 (guessing "no" correctly doesn't require a "who" pick at all). Max 6 points in a handshake week, 5 in a no-handshake week.

## Stack

- Vite 5 + React 18 + React Router
- Supabase (Postgres + Auth + Realtime) — no separate backend needed
- Plain CSS, no UI framework
- Deploy target: Vercel

## One-time setup

### 1. Create a Supabase project

Go to [supabase.com/dashboard](https://supabase.com/dashboard) → New Project. Once it's created:

1. Go to **SQL Editor** → paste in the contents of [`supabase/schema.sql`](./supabase/schema.sql) → Run.
2. Go to **Authentication → Providers → Email** and turn **off** "Confirm email" (this is a small private pool — instant sign-up is friendlier than waiting on confirmation emails). Leave it on if you'd rather require verified emails.
3. Go to **Project Settings → API** and copy the **Project URL** and **anon public key**.

### 2. Configure the app

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from step 1.

### 3. Install and run

```bash
npm install
npm run dev
```

### 4. Make yourself admin

Sign up once through the app's login screen with your own email, then back in the Supabase SQL Editor run:

```sql
update profiles set is_admin = true where email = 'you@example.com';
```

You'll now see an **Admin** tab in the nav.

### 5. Set up a season

As admin:

1. **Admin → Seasons** — add a season (e.g. "Series 15") and make it active.
2. **Admin → Contestants** — add each baker in the season.
3. **Admin → Weeks** — open Week 1 for picks.
4. Players sign up and submit picks on the **My Picks** page.
5. After the episode airs, go to **Admin → Results** and submit the actual outcomes — this scores the week and automatically marks the eliminated baker inactive.
6. Repeat steps 3–5 each week. The **Scoreboard** updates live.

## Deploying

```bash
npx vercel --prod
```

Set the same two env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the Vercel project's environment variables.
