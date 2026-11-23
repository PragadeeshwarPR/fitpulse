# FitPulse

AI-powered fitness, nutrition and lifestyle tracker, built as an installable **Progressive Web App**.
Track activities, meals, calories, macros, water, sleep and body measurements; scan food photos with **Google Gemini**; chat with an AI coach; and review daily, weekly and monthly progress. It works offline and syncs when you reconnect.

> Premium black & electric-green UI · dark mode by default (light mode included) · mobile-first

| | |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS 4, Recharts, TanStack Query, Workbox (vite-plugin-pwa), IndexedDB (`idb`) |
| **Backend** | Node.js 22, Express, TypeScript, Prisma ORM, Zod validation |
| **Database** | PostgreSQL 16 |
| **Auth** | Email + password, Argon2id hashing, HTTP-only session cookies, email verification, password reset |
| **AI** | Gemini (`gemini-2.5-flash` by default) for food image recognition, the fitness coach and daily insights. The key stays on the server. |
| **Images** | Cloudinary (falls back to local disk in development); only URLs are stored in PostgreSQL |
| **No Firebase** | |

## Repository layout
```
fitpulse/
├── frontend/            React PWA
│   ├── public/          manifest.json, icons/, favicon.ico
│   ├── scripts/         icon generator
│   └── src/
│       ├── components/  UI kit, charts, camera, nutrient inputs
│       ├── pages/       Landing, auth, onboarding, dashboard, food, scanner, activity, water, sleep, body, analytics, assistant, achievements, settings
│       ├── layouts/     App shell (sidebar / bottom nav, offline banner)
│       ├── services/    API client, IndexedDB, offline outbox and sync, React Query persistence
│       ├── hooks/       data hooks, GPS tracker, pedometer, PWA install, sync
│       ├── context/     auth, theme, toasts
│       ├── utils/       formatting, units, types
│       ├── styles/      theme tokens (dark/light)
│       └── sw.ts        service worker: precache, offline shell, background sync, push
├── backend/
│   ├── prisma/          schema.prisma, migrations, seed (food database)
│   ├── src/             config/ controllers/ middleware/ routes/ services/ validators/ utils/ server.ts
│   └── tests/           unit + API integration tests (Vitest + Supertest)
├── docs/                PRD.md, API_DOCUMENTATION.md, DATABASE_SCHEMA.md
└── docker-compose.yml
```

## Quick start (local development)

Prerequisites: Node.js ≥ 22 and PostgreSQL ≥ 14 (or Docker).

```bash
# 1. Database (or use your own PostgreSQL)
docker compose up -d db

# 2. Backend
cd backend
cp .env.example .env            # set GEMINI_API_KEY, or GEMINI_MOCK=true to try without a key
npm install
npx prisma migrate deploy       # create tables
npm run db:seed                 # load the food database (66 common foods incl. Indian dishes)
npm run dev                     # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173 (proxies /api to :4000)
```

In development, verification and password-reset emails are **printed to the backend console** unless `SMTP_HOST` is set.

### Full stack with Docker
```bash
cp backend/.env.example backend/.env
docker compose up --build        # http://localhost:8080
```

### Tests
```bash
cd backend && npm test           # 21 tests: health formulas, auth, isolation, sync idempotency/conflicts, AI scan (mock), export/delete
cd frontend && npm run build     # type-check + production build incl. service worker
```

## Environment variables
All secrets live in `backend/.env` (git-ignored). See [`backend/.env.example`](backend/.env.example).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `CORS_ORIGINS` | Allowed frontend origin(s), comma-separated. Also used for the CSRF Origin check. |
| `APP_URL` | Frontend URL used in email links |
| `TRUST_PROXY` | `true` behind a TLS-terminating proxy (required in production for HTTPS detection) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini access (server only) |
| `AI_DAILY_LIMIT` | Per-user daily AI request cap (default 50) |
| `GEMINI_MOCK` | `true` returns canned AI responses (dev/tests) |
| `CLOUDINARY_*` | Image storage (required in production) |
| `SMTP_*`, `EMAIL_FROM` | Transactional email |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push. Generate with `npx web-push generate-vapid-keys`. |

Frontend: `VITE_API_URL` (leave empty when the API is served from the same origin under `/api`).

## Deployment

1. **Database:** any managed PostgreSQL (Neon, Supabase Postgres, RDS, Railway, Render). Run `npx prisma migrate deploy` on release; the Docker image does this on start.
2. **Backend:** any Node host with env vars and HTTPS (Render, Railway, Fly.io, a VM). Set `NODE_ENV=production`, `TRUST_PROXY=true`, Cloudinary, SMTP and VAPID keys. Build with `npm run build`, start with `npm start`.
3. **Frontend:** any static host (Netlify, Vercel, Cloudflare Pages, S3 + CloudFront). Build with `npm run build`, publish `dist/`, and add an SPA fallback to `index.html`. Serve `sw.js` with `Cache-Control: no-cache`.

**Cookies across domains:** the session cookie is `HttpOnly; Secure; SameSite=None` in production. Browsers increasingly block third-party cookies, so serve the API **same-site** with the app:
- best: a host rewrite/proxy from `https://app.example.com/api/*` to the backend (as `frontend/nginx.conf` does), with `VITE_API_URL` left empty; or
- a sibling subdomain, e.g. app at `fitpulse.example.com` and API at `api.fitpulse.example.com`, with `VITE_API_URL=https://api.fitpulse.example.com`.

## How key features work

**Calorie targets:** BMI; BMR via Mifflin-St Jeor; TDEE = BMR × activity multiplier (1.2–1.9); goal adjustment (−500 kcal to lose, +250 to +400 to gain or build muscle) with a 1200/1500 kcal safety floor; protein 1.4–2.0 g/kg by goal, fat about 27% of calories, the rest carbs; fibre 14 g per 1000 kcal; water about 35 ml/kg.

**Calories burned:** MET × weight (kg) × hours, using Compendium MET values refined by speed for walking, running and cycling when distance is known. Users can override with a value from their wearable.

**AI food scanner:** the photo is resized on the device (≤ 1280 px) and sent to `/api/food/scan`. The server checks its type by magic bytes and asks Gemini for structured JSON. Every result is shown as an estimate with a confidence label (High, Medium or Low). Low confidence forces a clarification question, which re-runs the analysis with the user's answer. Users can correct the name, change the portion multiplier and edit every nutrient, then confirm or reject. Nothing is saved without confirmation.

**Offline:** the service worker precaches the app shell. React Query's cache is persisted to IndexedDB, so the dashboard and diary open offline. Meals, workouts, water and sleep logged offline go to an IndexedDB outbox and appear immediately, marked "Pending sync". They replay to `POST /api/sync` on reconnect, on an interval, and through Background Sync where supported. Records carry client-generated IDs, so retries never duplicate. Conflicting edits resolve server-wins and are reported to the user.

**Steps (honest limits):** browsers cannot count steps in the background. FitPulse offers manual daily totals, a motion-sensor counter that runs while the screen is open, and GPS sessions for walks, runs, rides and hikes, kept alive with a screen wake lock. The app explains these limits wherever steps appear.

**Security:** Argon2id password hashing; random 256-bit session tokens stored hashed with sliding expiry; HTTP-only cookies; CSRF Origin checks; Helmet headers; CORS allowlist; rate limiting on the API, auth and AI; per-user AI quotas; Zod validation on every input; upload size, type and magic-byte checks; strict per-user query scoping; generic error messages in production; data export and account deletion.

## MVP acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Register & log in | ✅ plus email verification, reset, change password |
| 2 | Profiles & goals in PostgreSQL | ✅ `user_profiles`, `user_goals` |
| 3 | Daily calorie targets | ✅ BMI / BMR / TDEE / macros |
| 4 | Log physical activities | ✅ 13 types, manual + GPS |
| 5 | Track calories burned | ✅ MET-based, speed-adjusted |
| 6 | Record meals | ✅ search DB, recent, favourites, manual |
| 7 | Gemini analyses food photos | ✅ (verified in mock mode; needs `GEMINI_API_KEY` for live) |
| 8 | Correct AI estimates | ✅ name, portion, every nutrient, clarification |
| 9 | Daily calories & macros | ✅ vs. personalised targets |
| 10 | Water & sleep | ✅ |
| 11 | View progress | ✅ dashboard, analytics (day/week/month/90d/custom), body trends, achievements |
| 12 | Installable PWA | ✅ manifest, icons, service worker, install prompt / iOS guide |
| 13 | Offline logging + sync | ✅ meals, workouts, water, sleep |
| 14 | Private & secure | ✅ see Security |
| 15 | Source in GitHub | Monorepo ready to push |

## Known limitations / roadmap
- **Wearables / Apple Health / Health Connect:** not reachable from a web app; a native companion would be needed. Manual entry covers this today.
- **Food database:** a curated seed of 66 foods. A larger dataset (e.g. USDA FoodData Central or IFCT for Indian foods) can be imported into `food_items`.
- **Offline:** offline edits are supported for creating and deleting meals, workouts, water and sleep. Body measurements, profile edits and AI features need a connection.
- **Push reminders:** an in-process minute scheduler. For multiple API instances, move it to a single worker or cron job.
- **Email:** console output in development; configure SMTP for production.
