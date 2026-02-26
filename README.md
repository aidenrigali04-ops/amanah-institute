# Amanah Institute

Halal wealth platform: Business Academy, Investing (automated + self-directed), Community, Zakat, and Family Accounts.

Target: ages 15–35. Tone: modern, clean, disciplined, wealth-focused.

**Deployment stack: Vercel (frontend) + Railway (backend + PostgreSQL).**

---

## Tech stack

| Layer        | Tech |
|-------------|------|
| **Backend** | Node.js, TypeScript, Express, Prisma |
| **Database**| PostgreSQL (Railway Postgres or any Postgres) |
| **Deploy**  | **Railway** (API + DB) |
| **Frontend**| Deploy to **Vercel** when ready (set `API_URL` to Railway API) |
| **Auth**    | JWT (Bearer token) |

---

## Local setup

1. **Install**
   ```bash
   npm install
   ```

2. **Database**
   - Create a PostgreSQL database and set `DATABASE_URL` in `.env` (see `.env.example`).
   - Apply migrations and seed:
   ```bash
   cp .env.example .env
   # Edit .env: DATABASE_URL, JWT_SECRET
   npx prisma migrate deploy
   npm run db:seed
   ```

3. **Run**
   ```bash
   npm run dev
   ```
   API: `http://localhost:4000`

---

## Deploy to Railway (backend + database)

1. **Railway**
   - Create a project at [railway.app](https://railway.app).
   - Add **PostgreSQL** (one-click); copy `DATABASE_URL` into your API service.
   - New service: deploy from this repo (GitHub connect). Railway uses `railway.toml` for build/start.

2. **Env on Railway**
   - `DATABASE_URL` – from the Postgres plugin (reference or copy).
   - `JWT_SECRET` – generate a strong secret for production.

3. **Deploy**
   - Push to your connected branch. Railway will:
     - **Build:** `npm run build` (runs `prisma generate` + `tsc`)
     - **Start:** `npx prisma migrate deploy && node dist/index.js`
   - After first deploy, run seed once (Railway CLI or one-off job):  
     `npx prisma db seed`

4. **API URL**
   - Use the generated Railway URL (e.g. `https://your-app.up.railway.app`) as your frontend’s `API_URL` / `NEXT_PUBLIC_API_URL` / `VITE_API_URL`.

---

## Deploy frontend to Vercel

When you add a frontend (e.g. Next.js, Vite, or Remix in this repo or another):

1. Create a Vercel project and connect the repo (or the frontend subfolder).
2. Set env:
   - `NEXT_PUBLIC_API_URL` or `VITE_API_URL` = your Railway API URL (e.g. `https://your-app.up.railway.app`).
3. Deploy. All API calls should go to the Railway backend.

---

## API overview

| Area       | Base path | Notes |
|-----------|-----------|--------|
| Auth      | `POST /api/auth/register`, `POST /api/auth/login` | Returns `user` + `token` |
| Onboarding| `GET/POST /api/onboarding` | Path: business \| investing \| both |
| Dashboard | `GET /api/dashboard` | Net worth, accounts, activity, **market feed preview**, **top gainers**, **academy topic**, **tool releases**, **workspace** link; `GET /api/dashboard/feed?limit=` full feed (watchlist first, then recommended; sentiment: neutral/positive/negative) |
| Academy   | `GET /api/academy/dashboard`, `GET /api/academy/topics` (by path), `GET /api/academy/tool-releases`, `GET /api/academy/test` (placeholder), modules, lessons, progress, action, badges | Topics ~3x/week by path; new tools announcements; Test my knowledge (coming soon) |
| Invest    | …; **top gainers**: `GET /api/invest/market/top-gainers?period=1d\|1wk\|1mo` (halal-filtered); market quote/ohlc/feed/quotes/search | |
| Workspace | `GET /api/workspace`, `PATCH /api/workspace`, `GET /api/workspace/projects`, `POST /api/workspace/projects`, `PATCH .../projects/:id` | User’s company workspace: company name, logo, branding; projects (logo, ad_campaign, branding, mockup). Future: Meta/Canva-style UI. |
| Community | `GET /api/community/channels`, `GET/POST .../channels/:id/posts`, `GET /api/community/posts/:id`, `POST .../posts/:id/replies` | |
| Zakat     | `GET /api/zakat`, `POST /api/zakat/calculate`, `GET /api/zakat/history`, `GET /api/zakat/report/:year` | |
| Profile   | `GET /api/profile`, `PATCH /api/profile`, `GET /api/profile/family`, `POST /api/profile/family/invite`, `GET /api/profile/family/activity` | |

Protected routes: `Authorization: Bearer <token>`.

---

## Database (Prisma + PostgreSQL)

- **Users** – auth, onboarding (experience level, risk profile, path), profile, family (parent/child).
- **Accounts** – holding, investment, self_directed; balances in cents.
- **PortfolioHoldings** – per-account positions; dividend purification.
- **Transactions** – deposits, withdrawals, transfers, trades.
- **Academy** – modules → lessons; progress per user/lesson; **AcademyTopic** (new topic by path), **ToolRelease** (new tools).
- **Dashboard feed** – **MarketFeedItem** (news/updates with sentiment); feed API merges watchlist quotes + feed items.
- **Workspace** – **Workspace** (per user: company name, logo, branding JSON), **WorkspaceProject** (logo, ad_campaign, branding, mockup).
- **Community** – channels, posts, replies.
- **Zakat** – one calculation per user per year.
- **Family** – parent/child links, permissions, activity log.

---

## Scripts

| Command           | Purpose |
|-------------------|--------|
| `npm run dev`     | Start API with watch |
| `npm run build`   | Prisma generate + TypeScript build |
| `npm start`       | Run production server |
| `npm run db:push` | Push schema (no migration files) |
| `npm run db:migrate` | Create/apply migrations (dev) |
| `npm run db:seed` | Seed academy, channels, halal symbols |
| `npm run db:studio` | Prisma Studio |

---

## Self-directed trading UI (TradingView-style)

A TradingView-style trading experience lives in the `web/` frontend:

- **Chart**: TradingView **Lightweight Charts** (candlesticks), fed by backend market data (Yahoo Finance).
- **Layout**: Top bar (symbol search, timeframes 1D–1Y, balance), left sidebar (watchlist, add halal symbols), main chart area, right panel (order entry: buy/sell, quantity, price, place order), bottom (positions + recent orders).
- **Execution**: Market orders use last price from `GET /api/invest/market/:symbol/quote`; buy/sell hit `POST /api/invest/orders/buy` and `POST /api/invest/orders/sell` for immediate execution.

Run the API and the web app:

```bash
# Terminal 1 – API
npm run dev

# Terminal 2 – Web (proxies /api to localhost:4000)
cd web && npm run dev
```

Open **http://localhost:3000** → sign in. Default landing is **Amanah Wealth Academy**; use the header to switch to **Trade**.

**Amanah Wealth Academy** (same web app, routes `/academy` and `/academy/lessons/:id`):
- **Dashboard**: Overall progress %, learning streak, badges count, “Continue Learning” card, learning paths with per-lesson progress, recent achievements, light/dark theme toggle.
- **Lesson viewer**: Markdown content, **Action Assignments** (saved per field), Mark as complete, Previous/Next lesson.
- **Backend**: Streak and last-activity updated when viewing/updating lessons; action responses stored per user/lesson; badges seeded (award logic can be extended later).

Run **seed** to get the first Business Foundations lesson (“Building a Company With Direction”) with full content and a 5-field Action Assignment (Business Sentence, Target Market, Pain Point, UVP, Revenue Model).
