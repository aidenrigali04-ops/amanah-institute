# Amanah Institute

Halal wealth platform: Business Academy, Investing (automated + self-directed), Community, Zakat, and Family Accounts.

Target: ages 15–35. Tone: modern, clean, disciplined, wealth-focused.

**Deployment:** Backend + DB on **Railway** · Frontend on **Vercel**

**Repo layout:** all backend code in **`backend/`**, all frontend code in **`frontend/`**.

**System architecture:** See **[docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md)** for a structured overview of the whole platform (homes, trading, academy, workspace, community, zakat), what’s implemented, and what’s planned.

---

## Tech stack

| Layer     | Tech |
|----------|------|
| Backend  | Node.js, TypeScript, Express, Prisma (in `backend/`) |
| Database | PostgreSQL (Railway or any Postgres) |
| Auth     | JWT (Bearer token) |
| Frontend | React, Vite, TypeScript (in `frontend/`) |

---

# Backend

API and database live in **`backend/`**. Deploy to **Railway** (set Root Directory to `backend`).

## Backend structure

```
backend/
├── prisma/
│   ├── schema.prisma      # Models, migrations
│   ├── seed.ts            # Academy, channels, halal symbols, feed/topics/tools
│   └── migrations/
├── src/
│   ├── index.ts           # Express app, route mounting
│   ├── config.ts
│   ├── lib/prisma.ts
│   ├── middleware/auth.ts
│   ├── routes/            # auth, onboarding, dashboard, academy, invest, community, zakat, profile, workspace
│   ├── services/          # marketData, academyStreak
│   └── types/
├── package.json
├── prisma.config.ts
└── railway.toml
```

## Backend setup

1. **Install**
   ```bash
   cd backend
   npm install
   ```

2. **Database**
   - Create a PostgreSQL database. In `backend/`, copy `.env.example` to `.env` and set `DATABASE_URL` and `JWT_SECRET`. (If you had a `.env` at repo root before the split, copy it to `backend/.env`.)
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env: DATABASE_URL, JWT_SECRET
   npx prisma migrate deploy
   npm run db:seed
   ```

3. **Run**
   ```bash
   cd backend
   npm run dev
   ```
   API: **http://localhost:4000**

## Backend scripts

| Command              | Purpose |
|----------------------|--------|
| `npm run dev`        | Start API with watch |
| `npm run build`      | Prisma generate + TypeScript build |
| `npm start`          | Production server (migrate + node) |
| `npm run db:push`    | Push schema (no migration files) |
| `npm run db:migrate` | Create/apply migrations (dev) |
| `npm run db:seed`    | Seed academy, channels, halal symbols, topics, tools, feed |
| `npm run db:studio`  | Prisma Studio |

## Backend deploy (Railway)

1. Create a project at [railway.app](https://railway.app); add **PostgreSQL** and copy `DATABASE_URL`.
2. New service from this repo; set **Root Directory** to `backend`. Set env: `DATABASE_URL`, `JWT_SECRET`.
3. Railway uses `backend/railway.toml`: build `npm run build`, start `npx prisma migrate deploy && node dist/index.js`.
4. After first deploy, run seed once from `backend/`: `npx prisma db seed`.
5. Use the Railway URL as the frontend’s API base (e.g. `VITE_API_URL`).

## API overview

| Area       | Base path | Notes |
|-----------|-----------|--------|
| Auth      | `POST /api/auth/register`, `POST /api/auth/login` | Returns `user` + `token` |
| Onboarding| `GET/POST /api/onboarding` | Path: business \| investing \| both |
| Dashboard | `GET /api/dashboard?topGainersPeriod=1h\|1d\|3d\|1wk\|1mo` | Net worth, accounts, activity, market feed preview, **top gainers** (1h/1d/3d/1wk/1mo), **chatUpdates** (community teaser), academy topic, tools, workspace; `GET /api/dashboard/feed` full feed |
| Academy   | **`GET /api/academy/home`**; `POST /api/academy/check-in`; topics, tool-releases, test, modules, lessons, progress, action, badges | |
| Invest    | Accounts, profile, deposit, transfer, holdings, watchlist, orders, analytics; market: quote, ohlc, feed, quotes, search, **top-gainers** `?period=1h\|1d\|3d\|1wk\|1mo` | |
| Workspace | `GET/PATCH /api/workspace`, `GET/POST/PATCH /api/workspace/projects` | |
| Community | Channels, posts, replies; **conversations** (DMs + collab): `GET/POST /api/community/conversations`, `GET .../conversations/:id`, `POST .../messages`, `POST .../participants` | |
| Zakat     | `GET /api/zakat`, calculate, history, report; **`GET /api/zakat/foundations`**, **`POST /api/zakat/donate`**, **`GET /api/zakat/donations`** | |
| Profile   | Profile, family, theme; **PATCH** supports `pathway`, `incomeGoalMonthlyCents`, `currentStage`, `currentMilestone`, **`businessPreferences`** (Q&A JSON) | |

Protected routes: `Authorization: Bearer <token>`.

## Database (Prisma + PostgreSQL)

- **Users** – auth, onboarding (experience, risk, path), profile, family.
- **Accounts** – holding, investment, self_directed; balances in cents.
- **PortfolioHoldings**, **Transactions** – positions, trades.
- **Academy** – modules → lessons; progress; **AcademyTopic**, **ToolRelease**.
- **MarketFeedItem** – news/updates with sentiment.
- **Workspace**, **WorkspaceProject** – company workspace, logo, campaigns, branding.
- **Community** – channels, posts, replies.
- **Zakat** – calculations per user per year.
- **Family** – parent/child, activity log.

---

# Frontend

React + Vite app in the **`frontend/`** folder. Deploy to **Vercel**.

## Frontend structure

```
frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx           # Routes: /login, /academy, /academy/lessons/:id, /trade
│   ├── api.ts            # API client (auth, dashboard, academy, invest, profile)
│   ├── index.css         # Theme, layout
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── AcademyDashboard.tsx
│   │   ├── LessonViewer.tsx
│   │   └── Trade.tsx     # TradingView-style trading
│   ├── components/
│   └── vite-env.d.ts
├── index.html
├── package.json
├── vite.config.ts        # Proxy /api → backend (e.g. localhost:4000)
└── tsconfig.json
```

## Frontend setup

1. **Backend must be running** (e.g. `cd backend && npm run dev`).
2. **Install and run**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   App: **http://localhost:3000** (Vite proxies `/api` to the backend).

## Frontend scripts

| Command         | Purpose |
|-----------------|--------|
| `npm run dev`   | Dev server (port 3000) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Frontend deploy (Vercel)

1. Create a Vercel project; connect this repo and set **Root Directory** to `frontend` (or set build to `cd frontend && npm run build` if using repo root).
2. Set env: `VITE_API_URL` = your Railway API URL (e.g. `https://your-app.up.railway.app`).
3. Deploy. All `/api` requests from the app should target the backend.

## Frontend features

- **Login** – Email/password; JWT stored in `localStorage`.
- **Academy** (`/academy`) – Dashboard with progress %, streak, badges, “Continue Learning”, learning paths, theme toggle. Lesson viewer with markdown and Action Assignments.
- **Trade** (`/trade`) – TradingView-style: symbol search, timeframes, Lightweight Charts, watchlist, order entry (buy/sell), positions, recent orders. Halal symbols only.
- **Default route** – After login, redirects to `/academy`.

Run **seed** on the backend to get the first Business Foundations lesson (“Building a Company With Direction”) with full content and a 5-field Action Assignment.
