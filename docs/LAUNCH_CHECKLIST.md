# Vireqo Launch Checklist

## Security before public sharing
- Rotate any exposed Groq API keys.
- Rotate the Render `SECRET_KEY` if it was pasted or shared.
- Confirm `.env`, `vireqo.db`, `.venv`, `.next`, and `node_modules` are not committed.
- Confirm production CORS only includes the live frontend domains and the current Vercel preview URL.

## Domain and deployment
- `https://www.vireqo.in` loads the frontend.
- `https://vireqo.in` redirects or loads correctly.
- Backend health works.
- PostgreSQL health returns ready.
- `api.vireqo.in` is connected when the custom backend domain is configured.

## Product QA
- Register a new account.
- Login, logout and login again.
- Create, edit and delete a test lead.
- Move a lead on the Kanban board.
- Open the deal drawer and timeline.
- Create and complete a task.
- Use AI Assistant to create a lead and task.
- Use Command Center, Draft Studio and AI History.
- Test Settings, data export and password change.
- Check mobile layout.
