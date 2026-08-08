# Frontend Deployment

Deploy the frontend as a separate Vercel project.

## Vercel settings

```text
Root Directory: frontend
Install Command: npm install
Build Command: npm run build
Output Directory: .next
```

## Required environment variable

```env
NEXT_PUBLIC_API_URL=https://your-backend-domain.onrender.com/api/v1
```

The `/api/v1` suffix is required because the frontend API client appends endpoint paths like `/auth/login` and `/leads`.

## WebSocket behavior

The live workspace WebSocket URL is created from `NEXT_PUBLIC_API_URL` automatically:

```text
https://.../api/v1 -> wss://.../api/v1/realtime/ws
```

No separate frontend WebSocket variable is needed.
