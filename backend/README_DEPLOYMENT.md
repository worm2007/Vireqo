# Backend Deployment

## Required production environment variables

```env
ENVIRONMENT=production
SECRET_KEY=<strong-random-value>
DATABASE_URL=<postgresql-url>
FRONTEND_URL=https://your-frontend-domain.vercel.app
BACKEND_PUBLIC_URL=https://your-backend-domain.onrender.com
CORS_ORIGINS=https://your-frontend-domain.vercel.app
GROQ_API_KEY=<optional-but-needed-for-ai>
AUTO_CREATE_TABLES=false
SEED_DEMO_DATA=false
```

## Start command

```bash
bash scripts/render_start.sh
```

The start script runs Alembic migrations before the server starts.

## Health check

```text
/health
```

Expected production response:

```json
{
  "status": "healthy",
  "environment": "production",
  "version": "0.4.0",
  "database": "postgresql"
}
```

## Local production-style smoke test

```bash
cd backend
source .venv/bin/activate
ENVIRONMENT=production python scripts/deploy_check.py
python scripts/check_database.py
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
