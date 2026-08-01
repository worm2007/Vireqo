# Vireqo Full-Stack MVP

Vireqo is a premium AI lead operating system starter. This repository includes a polished animated website, functional authentication, a live lead-capture demo, an AI concierge with a no-key fallback, a CRM dashboard, lead scoring, appointments and analytics.

## Included now

- Premium responsive landing page and design system
- Functional signup, login and demo login
- FastAPI + SQLAlchemy backend
- SQLite by default; PostgreSQL-ready through `DATABASE_URL`
- Real lead capture and persistent CRM records
- AI concierge conversation storage
- Optional Groq integration with safe local fallback
- Intent scoring: hot, warm and cold
- Protected leads and analytics endpoints
- Appointment API
- Connected dashboard with status updates
- Seeded demo account and data
- API tests

## Project structure

```text
vireqo-fullstack/
├── frontend/          Next.js + TypeScript + Framer Motion
├── backend/           FastAPI + SQLAlchemy
├── docker-compose.yml Optional local PostgreSQL
└── README.md
```

## 1. Start the backend

Open Terminal 1:

```bash
cd backend
python -m venv .venv
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Install and start:

```bash
pip install -r requirements.txt
cp .env.example .env  # Windows: copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Backend URLs:

- API: `http://localhost:8000`
- Interactive docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

The default database is SQLite, so PostgreSQL is not required for the first run.

## 2. Start the frontend

Open Terminal 2:

```bash
cd frontend
npm install
cp .env.example .env.local  # Windows: copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Demo account

- Email: `demo@vireqo.local`
- Password: `VireqoDemo123!`

You can also press **Enter the live demo workspace** on the login screen.

## Test the real workflow

1. Start both servers.
2. Open the homepage.
3. Submit the “Enter the system” lead form.
4. Open `/dashboard`.
5. The submitted lead will appear in the opportunity stream.
6. Open `/demo`, add a name/email and chat.
7. That conversation creates or updates a lead and its intent score.

## Optional Groq AI

The chatbot works without any AI key using a deterministic qualification fallback. To enable Groq, set these values before starting FastAPI:

```env
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.1-8b-instant
```

Never commit a real key.

## PostgreSQL mode

Start PostgreSQL:

```bash
docker compose up -d database
```

Set the backend environment:

```env
DATABASE_URL=postgresql+psycopg://vireqo:vireqo_dev_password@localhost:5432/vireqo
```

Restart FastAPI.

## Run backend tests

```bash
cd backend
pytest -q
```

## Important production work still required

This is a strong functional MVP foundation, not the final commercial release. Before charging customers, add:

- Alembic database migrations
- Email verification and password reset
- Rate limiting and bot protection
- Business-specific knowledge ingestion
- Calendar provider integration
- Resend email notifications
- Stripe or Razorpay subscriptions
- Role-based team permissions
- Audit logs and production observability
- Privacy, terms and data-retention controls
- Deployment secrets and stricter CORS

## Working brand

`Vireqo` is the working product name. Keep brand strings centralized when adding new modules until domain and trademark clearance is complete.
