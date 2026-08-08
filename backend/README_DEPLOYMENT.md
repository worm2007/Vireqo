# Backend Deployment

Sprint 4.5 hardens the backend for production-style testing before public deployment.

## Required production environment variables

```env
ENVIRONMENT=production
SECRET_KEY=<strong-random-value-at-least-32-characters>
DATABASE_URL=<postgresql-url>
FRONTEND_URL=https://your-frontend-domain.vercel.app
BACKEND_PUBLIC_URL=https://your-backend-domain.onrender.com
CORS_ORIGINS=https://your-frontend-domain.vercel.app
GROQ_API_KEY=<needed-for-ai-features>
AUTO_CREATE_TABLES=false
SEED_DEMO_DATA=false
REQUIRE_EMAIL_VERIFICATION=true
RATE_LIMIT_ENABLED=true
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
  "version": "0.4.5",
  "database": "postgresql",
  "rate_limit_enabled": true
}
```

## Local production-style smoke test

```bash
cd backend
source .venv/bin/activate
ENVIRONMENT=production \
SECRET_KEY=replace-with-a-strong-32-character-secret \
DATABASE_URL=postgresql://user:pass@localhost:5432/vireqo \
FRONTEND_URL=https://example.com \
BACKEND_PUBLIC_URL=https://api.example.com \
CORS_ORIGINS=https://example.com \
AUTO_CREATE_TABLES=false \
SEED_DEMO_DATA=false \
REQUIRE_EMAIL_VERIFICATION=true \
python scripts/deploy_check.py
```

## Clean backend ZIP

Never share a ZIP that contains `.env`, `.venv`, `vireqo.db`, caches or macOS metadata. Create a clean backend release with:

```bash
python scripts/create_backend_release_zip.py
```
