# Amanah Institute — System Architecture

A single, structured reference for the whole platform. Use this for product, design, and engineering alignment.

**Target users:** Ages 15–35  
**Tone:** Modern, clean, disciplined, wealth-focused  
**Product feel:** A wealth operating system — not a content site or a generic app.

---

## 1. Overall Purpose

Amanah Institute is an **all-in-one halal wealth platform** that helps users:

- **Learn** how to build income (Business Academy)
- **Invest** in sharia-compliant ways (automated + self-directed)
- **Connect** with others (Community)
- **Give** correctly (Zakat, Sadaqah, Sadaqah Jariyah)
- **Build** their brand and marketing (Workspace)

The platform has **one main app home** (Dashboard) and **feature-specific homes** (Trading Dashboard Home, Academy Dashboard Home) so each pillar has a clear landing and next steps.

---

## 2. Platform Pillars (High Level)

| Pillar        | Route base         | Purpose in one line                          |
|---------------|--------------------|----------------------------------------------|
| Dashboard     | `/dashboard`       | Central control: net worth, next action, feeds |
| Trading       | `/invest`, `/trade`| Halal investing + self-directed trading      |
| Academy       | `/academy`         | Business education and builder progress     |
| Workspace     | `/workspace`       | Internal branding, logo, ads, workflows      |
| Community     | `/community`       | Channels, chat, DMs, collab                  |
| Zakat         | `/zakat`           | Calculator, history, charity giving          |
| Profile       | `/profile`         | Identity, family accounts, settings         |

---

## 3. Onboarding

- **When:** After signup; optional steps if user already exists.
- **Stored:** Experience level, risk tolerance, chosen path (business | investing | both), goals.
- **Paths:** Business path, Investing path, Both.
- **Outcome:** Default accounts created (e.g. holding); user directed to the right home (dashboard, then academy or invest based on path).

**Implemented:** `GET/POST /api/onboarding`; experience level, risk profile, onboarding path, goals; default account creation.

---

## 4. Home Overviews

There are **three home surfaces** (no duplication of logic):

1. **Main app home (Dashboard)** — `/dashboard`  
   Central overview for the whole product.

2. **Trading dashboard home** — `/invest` (or `/invest/home`)  
   Landing when the user is in “investing” mode: portfolio snapshot, quick trade, watchlist teaser, market pulse.

3. **Academy dashboard home** — `/academy`  
   Landing for learning: progress, “continue lesson”, income goal, next actions, modules.

---

### 4.1 Main Dashboard Home (`/dashboard`)

**Purpose:** “Here’s where you stand. Here’s what to do next.”

| Component | Description | Status |
|-----------|-------------|--------|
| Net worth snapshot | Cash + investments | ✅ |
| Account summary | Holding, investment, self-directed | ✅ |
| Recent activity | Last transactions | ✅ |
| Next recommended action | e.g. Continue lesson, Deposit, Calculate Zakat | ✅ |
| **Market & news updates** | Stock/company and price updates; click → full-screen market & news page | ✅ |
| **Top gainers** | Biggest % gainers; options: **1h, 1d, 3d, 1wk, 1mo** (1h/1d from screener; 3d from historical; 1wk/1mo same as 1d) | ✅ Backend |
| **Chat updates panel** | Teaser of community activity; click → Community page | ✅ Backend (`chatUpdates` in dashboard); 🔲 Frontend |
| **Q&A / business preference** | Short questions tied to user’s business path (e.g. niche, offer); stored in profile | ✅ Backend (`businessPreferences` GET/PATCH profile); 🔲 Frontend |
| **Test knowledge panel** | Short quiz; links to academy test | ✅ URL `/academy/test` (backend placeholder) |
| **My workspace panel** | Link to user’s workspace; click → full-screen Workspace | ✅ |
| **New tools updates** | e.g. “Loveable released content generation”; list of tool releases | ✅ |
| **My academy dashboard panel** | Link to Academy dashboard home | ✅ |

**API:** `GET /api/dashboard` (aggregate); `GET /api/dashboard/feed` (full market feed).

---

### 4.2 Trading Dashboard Home (`/invest` or `/invest/home`)

**Purpose:** “Your investing hub: portfolio, watchlist, market pulse.”

| Component | Description | Status |
|-----------|-------------|--------|
| Portfolio snapshot | Accounts, balances, holdings summary | ✅ |
| Watchlist teaser | Top watchlist symbols with price | ✅ |
| Top gainers (1h, 1d, 3d, 1wk, 1mo) | Same as main dashboard; dropdown for period | ✅ Backend (`?period=1h|1d|3d|1wk|1mo`); 🔲 Frontend |
| Quick actions | Deposit, Trade, View portfolio | ✅ |
| Sidebar (uncollapsed) | Watchlist, Screener, Full analysis | 🔲 UI (sidebar; backend ready) |

**API:** `GET /api/invest/accounts`, holdings, watchlist, analytics; `GET /api/invest/market/top-gainers?period=1h|1d|3d|1wk|1mo`.

---

### 4.3 Academy Dashboard Home (`/academy`)

**Purpose:** “You are building something. Here’s your progress and next step.”

| Component | Description | Status |
|-----------|-------------|--------|
| Pathway badge | Starter / Builder / Scaler + experience level | ✅ |
| Progress bar | % completed, modules completed, current stage | ✅ |
| Primary action button | Continue lesson / Build your offer / Validate idea | ✅ |
| Income goal tracker | 6-month goal, current stage, milestone ladder | ✅ |
| Next best action panel | This week’s focus (e.g. refine market, pricing) | ✅ |
| Core module sections | Foundations, Offer & Revenue, Marketing, Operations, Scaling; % and Continue | ✅ |
| Builder insights | Rotating tips (e.g. pricing, niche) | ✅ |
| Templates & tools shortcut | Offer builder, pricing calculator, etc. | ✅ |
| Accountability widget | Weekly builder check-in | ✅ |
| Community shortcut | Discuss strategy, channels | ✅ |
| Achievement / milestone badges | First offer, first client, revenue milestone | ✅ |
| Reduce clutter | Layout hierarchy; optional collapse of secondary blocks | 🔲 UI refinement |

**API:** `GET /api/academy/home` (full payload); `POST /api/academy/check-in`; topics, tool-releases, test.

---

## 5. Trading (Invest + Self-Directed)

| Area | Description | Status |
|------|-------------|--------|
| **Market updates click-through** | From dashboard or trading home → **full-screen market & news page** | ✅ Route/API |
| **Full-screen market & news page** | News ranked by sentiment (positive, neutral, negative) per company; important analysis: bullish/bearish, volatility; other metrics as needed | ✅ Feed + live insights; sentiment; analysis labels in UI |
| **Watchlist page** | User’s watchlist with market and price info per symbol | ✅ API + Trade UI |
| **Stocks screener page** | Filter halal stocks (e.g. by sector, performance) | 🔲 Backend: halal list + market data; UI screener page |
| **Analysis / P&L page** | All P&L, allocation, performance | ✅ `GET /api/invest/analytics` |
| **Sidebar** | Watchlist, Screener, Full analysis as uncollapsed sidebar options to reduce clutter | 🔲 UI |
| **Trade execution page** | User selects symbol (personal trading account); **chart (TradingView-style)**, summarized market & news, overall analysis (bullish/bearish, volatility) | ✅ Trade page with chart, order entry, positions; news/analysis can be surfaced |

**APIs:**  
- Market: `quote`, `ohlc`, `search`, `feed`, `top-gainers`, `:symbol/news`.  
- Self-directed: accounts, watchlist CRUD, orders (buy/sell), holdings, transactions, analytics.

**Top gainers periods:** Backend supports `1h | 1d | 3d | 1wk | 1mo` (1h/1d from screener; 3d from historical close; 1wk/1mo same as 1d for now). Frontend can add dropdown.

---

## 6. Academy

| Area | Description | Status |
|------|-------------|--------|
| Academy dashboard home | As in §4.3; reduce clutter as needed in UI | ✅ Backend |
| Modules & lessons | Foundations, Offer & Revenue, Branding, Marketing, Operations, Scaling | ✅ |
| Lesson viewer | Markdown, action assignments, progress | ✅ |
| Progress & streaks | Stored and shown on academy home | ✅ |
| Badges & milestones | Earned badges; milestone ladder | ✅ |
| Test my knowledge | Short quiz; placeholder endpoint | ✅ Placeholder |
| Topics & tool releases | New topics ~3×/week by path; new tools announcements | ✅ |

No new backend scope needed for “refine to reduce clutter”; that’s UI/layout.

---

## 7. Workspace

**Purpose:** Internal platform where users build their company: branding, logo, workflows, ad content, marketing tools.

| Area | Description | Status |
|------|-------------|--------|
| Foundation | Workspace per user; company name, logo, branding settings; projects (logo, ad_campaign, branding, mockup) | ✅ |
| Full-screen workspace | My workspace panel → full-screen workspace experience | ✅ Route/API; UI can stream here |
| Future: Canva-like UI | Logo and creative mockups | 🔲 Planned |
| Future: Miro-like UI | Boards and collaboration | 🔲 Planned |
| Future: Simplified n8n-like | Workflows and marketing automation | 🔲 Planned |
| Future: Meta integration | Instagram/Facebook campaigns | 🔲 Planned |

**API:** `GET/PATCH /api/workspace`; `GET/POST/PATCH /api/workspace/projects`.

---

## 8. Community

| Area | Description | Status |
|------|-------------|--------|
| Main community page | Channels list, entry to chat | ✅ Backend; 🔲 Frontend (main chat UI) |
| Chat page | Main chat experience (UI provided later) | 🔲 Frontend |
| 1-on-1 (DMs) | Direct messages between two users | ✅ Backend (conversations type=dm, messages); 🔲 Frontend |
| Collab option | When chatting, option to open “collab” → joint chat platform | ✅ Backend (conversations type=collab, add participants); 🔲 Frontend |
| Joint chat platform | Users work together; academy-like but interactive, user-to-user; video chat | ✅ Backend (conversation + messages + participants); 🔲 Frontend (incl. video later) |

**API:** Channels, posts, replies; **conversations** (list, create DM/collab), **conversations/:id** (messages, paginated), **conversations/:id/messages** (send), **conversations/:id/participants** (add for collab).

---

## 9. Zakat

| Area | Description | Status |
|------|-------------|--------|
| Zakat calculator | Nisab, eligible assets, breakdown, zakat due | ✅ |
| History | Past years’ calculations | ✅ |
| Report | Downloadable report per year | ✅ |
| **Charity foundations** | List of foundations users can give to (Zakat, Sadaqah, Sadaqah Jariyah) | ✅ Backend (foundations + donate + donations list); 🔲 Frontend |

**API:** `GET /api/zakat`, `POST /api/zakat/calculate`, `GET /api/zakat/history`, `GET /api/zakat/report/:year`, `GET /api/zakat/foundations`, `POST /api/zakat/donate`, `GET /api/zakat/donations`.

---

## 10. Data Models (Summary)

| Domain | Main entities |
|--------|----------------|
| Users & auth | User, onboarding fields, theme, pathway, income goal, stage, milestone |
| Investing | InvestmentProfile, Account, PortfolioHolding, Transaction, HalalSymbol, WatchlistItem, Order |
| Academy | AcademyModule, AcademyLesson, AcademyProgress, Badge, UserBadge, ActionAssignmentResponse, BuilderCheckIn, AcademyTopic, ToolRelease |
| Dashboard / feed | MarketFeedItem (news + sentiment) |
| Workspace | Workspace, WorkspaceProject |
| Community | CommunityChannel, CommunityPost, CommunityReply |
| Zakat | ZakatCalculation |
| Family | User (parent/child), FamilyActivityLog |
| Compliance | ComplianceLog |

**Implemented:** `Conversation`, `ConversationParticipant`, `ConversationMessage` (DM + collab); `CharityFoundation`, `Donation` (zakat/sadaqah/sadaqah_jariyah); `User.businessPreferences` (JSON).

---

## 11. API Map (Quick Reference)

| Area | Key endpoints |
|------|----------------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login` |
| Onboarding | `GET/POST /api/onboarding` |
| Dashboard | `GET /api/dashboard?topGainersPeriod=1h|1d|3d|1wk|1mo`, `GET /api/dashboard/feed?limit=&live=` |
| Academy | `GET /api/academy/home`, `GET /api/academy/dashboard`, `GET /api/academy/modules`, `GET /api/academy/lessons/:id`, `POST /api/academy/check-in`, `GET /api/academy/topics`, `GET /api/academy/tool-releases`, `GET /api/academy/test` |
| Invest | Accounts, profile, deposit, transfer, holdings, watchlist, orders, `GET /api/invest/analytics`, `GET /api/invest/market/quote`, `ohlc`, `top-gainers?period=1h|1d|3d|1wk|1mo`, `:symbol/news`, feed, search, halal-symbols |
| Workspace | `GET/PATCH /api/workspace`, `GET/POST/PATCH /api/workspace/projects` |
| Community | `GET /api/community/channels`, `GET/POST .../channels/:id/posts`, replies; **conversations:** `GET/POST /api/community/conversations`, `GET /api/community/conversations/:id`, `POST .../messages`, `POST .../participants` |
| Zakat | `GET /api/zakat`, `POST /api/zakat/calculate`, `GET /api/zakat/history`, `GET /api/zakat/report/:year`, `GET /api/zakat/foundations`, `POST /api/zakat/donate`, `GET /api/zakat/donations` |
| Profile | `GET/PATCH /api/profile` (includes pathway, income goal, stage, milestone, **businessPreferences**) |

---

## 12. UI Consistency Notes

- **Homes:** One main dashboard home; one trading home; one academy home. No duplicate “home” logic.
- **Navigation:** Persistent left sidebar; Watchlist, Screener, Analysis as sidebar options in Trading to reduce clutter.
- **Market & news:** Single full-screen market & news page (from dashboard or trading); news by sentiment and analysis (bullish/bearish, volatility).
- **Workspace:** One workspace per user; “My workspace” panel → full-screen workspace.
- **Academy:** One academy dashboard home; “My academy dashboard” panel → academy home.

This document is the single source of truth for the platform’s structure. Refinements (e.g. 1h/3d top gainers, charity foundations, DMs/collab) should be added here and then implemented in code.
