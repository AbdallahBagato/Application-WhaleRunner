# 🐳 Whale Runner (DIY Edition) — Requirements

You asked for **code + requirements only** — no Dockerfiles, no compose. You will containerize it yourself.
The full stack was tested end-to-end before packaging (static files ✓, proxy ✓, score save/read ✓, rows verified inside PostgreSQL ✓).

## 1. Architecture (3 tiers)

```
Browser ──:3000──▶ Tier 1: FRONTEND (Node.js + Express)
                     │  serves public/ (index.html, style.css, game.js)
                     │  proxies /api/*  ──▶
                     ▼
                  Tier 2: BACKEND (Python Flask + gunicorn)  :5000
                     │  REST: /api/health, GET/POST /api/scores
                     ▼
                  Tier 3: DATABASE (PostgreSQL 16)  :5432
                     table "scores" (auto-created by the backend on startup)
```
The browser only ever talks to the frontend (single origin → no CORS needed).

## 2. Required Database

| Item | Value |
|---|---|
| Engine | **PostgreSQL 16** (image suggestion: `postgres:16-alpine`) |
| Database name | `whalerunner` |
| User | `whale` |
| Password | **your choice** — pass it via env var, never hardcode |
| Port | `5432` |
| Data directory (persist me!) | `/var/lib/postgresql/data` → mount a **named volume** here |
| Schema | none needed — the backend creates the `scores` table itself (with retry while the DB boots) |

Official postgres image env vars that create all of the above on first start:
`POSTGRES_DB=whalerunner  POSTGRES_USER=whale  POSTGRES_PASSWORD=<yourpass>`
Readiness command (useful for a HEALTHCHECK): `pg_isready -U whale -d whalerunner`

## 3. Environment-variable contract (each tier reads ONLY these)

**Backend (Flask):**

| Var | Default | Meaning |
|---|---|---|
| `DB_HOST` | `db` | hostname of PostgreSQL — designed for Docker DNS: name your db container `db` on a shared user-defined network |
| `DB_PORT` | `5432` | |
| `DB_NAME` | `whalerunner` | |
| `DB_USER` | `whale` | |
| `DB_PASSWORD` | `changeme` | ⚠ always override |

**Frontend (Node):**

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | port the Node server listens on |
| `API_URL` | `http://api:5000` | base URL of the backend — designed for Docker DNS: name your backend container `api` |

## 4. Runtimes & dependencies

**Frontend** — Node.js ≥ 18 (suggest 22). Deps in `package.json`: `express`, `http-proxy-middleware`.
Install: `npm ci` (or `npm install`) · Start: `npm start` (= `node server.js`) · Health: `GET /healthz`

**Backend** — Python 3.11+ (suggest 3.12). Deps in `requirements.txt`: `flask`, `psycopg2-binary`, `gunicorn`.
Install: `pip install -r requirements.txt` · Start (production): `gunicorn --bind 0.0.0.0:5000 --workers 2 app:app` · Health: `GET /api/health` (returns 503 if DB down)

## 5. Start order & verification

1. **db** first → wait until `pg_isready` succeeds.
2. **backend** → logs `[init] scores table ready`; then `curl localhost:5000/api/health` → `{"db":"up","status":"ok"}`.
3. **frontend** → `curl localhost:3000/healthz`, then open `http://localhost:3000`, play, save a score.
4. Verify persistence: `curl localhost:3000/api/scores` shows your score; restart/recreate the db container (volume kept) → score still there.

## 6. Your Dockerfile homework — what each image must achieve (no spoilers)

- **backend image**: Python base (pin the tag) → install requirements → copy `app.py` → run gunicorn as an **exec-form** CMD → non-root `USER` → `EXPOSE 5000` → HEALTHCHECK hitting `/api/health`. Bonus: multi-stage (build wheels first).
- **frontend image**: Node base (pin) → copy `package*.json` **before** the rest (layer-cache!) → `npm ci --omit=dev` → copy `server.js` + `public/` → non-root (`node` user exists in the official image) → `EXPOSE 3000` → exec-form `CMD ["node","server.js"]` → HEALTHCHECK hitting `/healthz`.
- **db**: official `postgres:16-alpine` — no custom Dockerfile needed; configure with the env vars above.
- **wiring**: one user-defined network (or two, if you want to hide the db from the frontend like the classroom version); container names `db` and `api` so the defaults just work; named volume on the postgres data dir; publish **only** the frontend port (e.g. `-p 80:3000`).

## 7. API reference (for testing)

```
GET  /api/health           → {"db":"up","status":"ok"} | 503 {"db":"down",...}
GET  /api/scores           → top 10: [{"player","score","played_at"}, ...]
POST /api/scores           body: {"player":"name","score":123}
                           → 201 {"saved":true,...} · 400 on invalid/absurd score
```

Have fun — when it runs, the leaderboard is your proof. 🏆
