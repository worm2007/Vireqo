# Vireqo Account Privacy Controls

Sprint 4.4 adds workspace-level account controls for local development and production SaaS readiness.

## Endpoints

- `PATCH /api/v1/account/profile` — update the signed-in user's display name.
- `GET /api/v1/account/export/summary` — show export counts for users, leads, conversations, appointments, tasks and audit logs.
- `GET /api/v1/account/export` — export the signed-in workspace data as JSON.
- `DELETE /api/v1/account` — permanently delete the workspace. Owner role, password and confirmation phrase are required.

## Deletion guardrails

Workspace deletion requires:

1. Owner role.
2. Current password.
3. Exact confirmation phrase: `DELETE MY WORKSPACE`.

Deletion removes the business and cascades workspace data through the existing foreign key relationships.

## Export format

The export response uses the format marker:

```json
"vireqo.account_export.v1"
```

It includes business profile, team users, leads, appointments, conversations with messages, tasks and audit logs.
