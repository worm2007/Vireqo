# Vireqo Full-Stack Backend Edition

Vireqo is a premium AI lead operating system. This release keeps the approved animated website and adds a complete functional backend foundation for authentication, multi-tenant CRM data, conversations, appointments, business settings and team access.

## What works now

### Authentication and account security

- Owner registration creates a new business workspace
- Login with secure PBKDF2 password hashing
- Short-lived JWT access tokens
- Opaque refresh tokens stored as hashes and rotated on refresh
- Logout revokes the refresh token
- Protected `/auth/me` session endpoint
- Change password with automatic session revocation
- Forgot-password and one-use reset-token workflow
- Optional Resend email delivery
- Local development reset link when no email provider is configured
- Demo workspace login

### Workspace and team

- Multi-tenant business separation
- Read and update business profile
- Custom business description, website, brand colour and AI greeting
- Owner/admin/member roles
- Add team members
- Change member roles
- Activate or deactivate member access
- Owner and self-deactivation safeguards

### CRM and operations

- Public website lead capture
- Lead deduplication by business and email
- Protected lead creation, listing, search and filters
- Lead detail, full editing, scoring, status changes and deletion
- AI chatbot conversation persistence
- Protected conversation history and deletion
- Public appointment booking
- Appointment conflict and past-time validation
- Appointment listing, status updates and deletion
- Business analytics
- Audit trail for important account and CRM changes

### Frontend connections

- Functional signup and login pages
- Forgot-password and reset-password pages
- Automatic access-token refresh
- Protected dashboard with sign-out
- Real user and workspace identity in the dashboard
- Opportunities management page
- Conversations page
- Appointments page
- Business and password settings page
- Team management page
- Existing premium homepage, motion and slim left chatbot preserved

## Start the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --reload-dir app
```

Backend URLs:

- API: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/health`

## Start the frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Demo account

- Email: `demo@vireqo.local`
- Password: `VireqoDemo123!`

## Test the backend

```bash
cd backend
pytest -q
```

The test suite covers the existing demo workflow plus registration, duplicate-account protection, login, access-token authentication, refresh-token rotation, business updates, team access, lead CRUD, search, appointments, audit logs, password reset and logout revocation.

## Password reset in development

With `ENVIRONMENT=development` and no `RESEND_API_KEY`, the forgot-password page displays a local one-time reset link. This makes the complete flow testable without an email provider.

For real emails, set:

```env
RESEND_API_KEY=your_resend_key
EMAIL_FROM=Vireqo <your-verified-sender@example.com>
```

## Database

SQLite works immediately:

```env
DATABASE_URL=sqlite:///./vireqo.db
```

PostgreSQL is supported:

```bash
docker compose up -d database
```

```env
DATABASE_URL=postgresql+psycopg://vireqo:vireqo_dev_password@localhost:5432/vireqo
```

## Security notes before public production

This is a strong functional SaaS backend, but a public commercial launch should additionally use managed PostgreSQL, database migrations, HTTPS-only deployment, stricter production CORS, distributed rate limiting, monitored email delivery, backups, error monitoring and formal privacy/data-retention controls. Payments and third-party calendar integrations are separate external-service milestones.
