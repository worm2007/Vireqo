# Vireqo Production Deployment Guide

This guide deploys Vireqo as two services:

- Frontend: Vercel
- Backend API: Render
- Database: PostgreSQL on Render

## 1. Backend on Render

### Recommended path: Render Blueprint

1. Push this repo to GitHub.
2. Open Render and create a new Blueprint from the repository.
3. Render will read `render.yaml` and create:
   - `vireqo-api`
   - `vireqo-postgres`
4. Set these backend environment variables in Render:

```env
FRONTEND_URL=https://your-frontend-domain.vercel.app
BACKEND_PUBLIC_URL=https://your-backend-domain.onrender.com
CORS_ORIGINS=https://your-frontend-domain.vercel.app
GROQ_API_KEY=your-groq-key
EMAIL_FROM=Vireqo <your@email.com>
RESEND_API_KEY=optional
```

The backend startup script runs:

```bash
alembic upgrade head
python scripts/check_database.py
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## 2. Frontend on Vercel

1. Import the same GitHub repo into Vercel.
2. Set the Vercel project root to:

```text
frontend
```

3. Add this environment variable:

```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.onrender.com/api/v1
```

4. Deploy.

## 3. Connect frontend and backend

After Vercel gives you the frontend URL, go back to Render and set:

```env
FRONTEND_URL=https://your-frontend-domain.vercel.app
CORS_ORIGINS=https://your-frontend-domain.vercel.app
```

Redeploy the backend after changing these values.

## 4. Production checks

Run locally before pushing deployment changes:

```bash
cd backend
source .venv/bin/activate
python scripts/deploy_check.py
python scripts/check_database.py
```

For production Render logs, confirm:

```text
alembic upgrade head
status: healthy
```

## 5. Important notes

- Do not use SQLite in production.
- Do not commit `.env`, database files, `.next`, or `node_modules`.
- Do not put API keys in frontend environment variables unless they are intended to be public.
- `NEXT_PUBLIC_API_URL` must include `/api/v1`.
- WebSockets use the same API URL and automatically switch from `https` to `wss`.
