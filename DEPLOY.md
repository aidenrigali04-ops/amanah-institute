# Deploy Amanah Institute: Railway (backend) + Vercel (frontend)

Follow these steps to connect your GitHub repo to Railway and Vercel.

---

## Part 1: Railway (backend + database)

### Step 1: Create a Railway account and project

1. Go to [railway.app](https://railway.app) and sign up (or log in with GitHub).
2. Click **New Project**.
3. Choose **Deploy from GitHub repo**.
4. Select your GitHub account and the **amanah-institute** repository.
5. Authorize Railway to access the repo if prompted.

### Step 2: Add PostgreSQL

1. In your Railway project, click **+ New**.
2. Select **Database** → **PostgreSQL**.
3. Railway will create a Postgres service and show a **DATABASE_URL** (or **Postgres** with a connection URL). Copy it or use the **Connect** tab to get the URL.

### Step 3: Configure the backend service

1. In the same project, click **+ New** again.
2. Select **GitHub Repo** and choose **amanah-institute** again (so you have two services: Postgres + API).
3. After the service is created, open it and go to **Settings**.
4. Set **Root Directory** to **`backend`**.  
   This makes Railway build and run only the `backend/` folder.
5. Under **Variables**, add:
   - **DATABASE_URL**  
     Paste the PostgreSQL connection URL from the Postgres service (or use Railway’s reference variable, e.g. `${{Postgres.DATABASE_URL}}` if you named the DB service "Postgres").
   - **JWT_SECRET**  
     Generate a long random string (e.g. `openssl rand -base64 32`) and paste it.
6. Save. Railway will redeploy.

### Step 4: Build and start commands (optional check)

Railway should use `backend/railway.toml` when Root Directory is `backend`. Confirm:

- **Build command:** `npm run build` (runs `prisma generate` and `tsc`)
- **Start command:** `npx prisma migrate deploy && node dist/index.js`

If you don’t use `railway.toml`, set these in the service **Settings** → **Deploy**.

### Step 5: Get the backend URL

1. Open your **backend service** (the one with Root Directory `backend`).
2. Go to **Settings** → **Networking** (or **Deployments**).
3. Click **Generate Domain** to get a public URL, e.g.  
   `https://amanah-institute-backend-production-xxxx.up.railway.app`
4. Copy this URL; you’ll use it as the API URL in Vercel.

### Step 6: Run database seed (one time)

1. Install Railway CLI: `npm i -g @railway/cli` (or use [docs](https://docs.railway.app/develop/cli)).
2. Log in: `railway login`.
3. Link the project: `railway link` (select the project and the **backend** service).
4. Run seed from repo root:  
   `cd backend && railway run npx prisma db seed`  
   (or run the same command in Railway’s shell if available).

---

## Part 2: Vercel (frontend)

### Step 1: Create a Vercel account and import the repo

1. Go to [vercel.com](https://vercel.com) and sign up (or log in with GitHub).
2. Click **Add New** → **Project**.
3. Import the **amanah-institute** repository from GitHub.
4. If you don’t see it, click **Adjust GitHub App Permissions** and grant Vercel access to the repo.

### Step 2: Configure the frontend project

1. After selecting the repo, Vercel will detect it. Set:
   - **Root Directory:** click **Edit** and set to **`frontend`**.
   - **Framework Preset:** Vite (should be auto-detected).
   - **Build Command:** `npm run build` (default for Vite).
   - **Output Directory:** `dist` (default for Vite).
2. Click **Environment Variables** and add:
   - **Name:** `VITE_API_URL`
   - **Value:** your Railway backend URL from Part 1 (e.g. `https://amanah-institute-backend-production-xxxx.up.railway.app`).  
   Do **not** add a trailing slash.
3. Click **Deploy**. Vercel will build and deploy the frontend.

### Step 3: Use the frontend URL

1. After deployment, Vercel gives you a URL like `https://amanah-institute-xxx.vercel.app`.
2. Open it; the app will call the Railway API using `VITE_API_URL`.
3. (Optional) In **Settings** → **Domains**, add a custom domain.

---

## Part 3: CORS and production checklist

### Backend CORS

The backend uses `cors({ origin: true })`, so it accepts requests from any origin (including your Vercel URL). For production you can tighten this later in `backend/src/index.ts` to your Vercel domain.

### Frontend API base URL

- In `frontend`, the API client should use `import.meta.env.VITE_API_URL` as the base URL for all `/api` requests.
- Ensure `frontend/src/api.ts` (or equivalent) uses this env var so production builds use the Railway URL.

### Check list

- [ ] Railway: Postgres added and `DATABASE_URL` set on the backend service.
- [ ] Railway: Backend **Root Directory** = `backend`.
- [ ] Railway: `JWT_SECRET` set on the backend service.
- [ ] Railway: Backend has a generated public domain.
- [ ] Railway: `railway run npx prisma db seed` run once from `backend/`.
- [ ] Vercel: **Root Directory** = `frontend`.
- [ ] Vercel: `VITE_API_URL` = your Railway backend URL (no trailing slash).
- [ ] Vercel: Deployment succeeded and site loads; login and API calls work.

---

## Quick reference

| Item        | Where        | Value / action |
|------------|---------------|----------------|
| Backend URL| Railway       | Use as `VITE_API_URL` in Vercel |
| Database   | Railway       | Postgres; `DATABASE_URL` on backend service |
| JWT secret | Railway       | Env var `JWT_SECRET` on backend service |
| API base   | Vercel        | Env var `VITE_API_URL` = Railway backend URL |
| Root (API) | Railway       | `backend` |
| Root (Web) | Vercel        | `frontend` |

---

## Troubleshooting

- **Backend 404 / wrong path:** Ensure Railway Root Directory is **backend** and redeploy.
- **DB connection errors:** Check `DATABASE_URL` on Railway; ensure it’s the Postgres service URL and the backend service can reach it.
- **Frontend can’t reach API:** Check `VITE_API_URL` in Vercel (no trailing slash); rebuild after changing env vars.
- **Migrations:** Each deploy runs `npx prisma migrate deploy` before starting the app; for new migrations, push to main and let Railway redeploy.
