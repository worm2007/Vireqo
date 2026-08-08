# Vireqo Production QA

Use this file before every public demo.

## Critical flows
1. Homepage opens on `www.vireqo.in`.
2. Signup succeeds.
3. Login succeeds.
4. Dashboard loads without console errors.
5. Opportunities page loads.
6. Tasks page loads.
7. AI Assistant responds.
8. Command Center opens with `Cmd/Ctrl + K`.
9. Draft Studio stays within viewport and scrolls.
10. Settings page data export works.

## Browser checks
- Chrome desktop
- Safari desktop
- Mobile Chrome/Safari

## API checks
- `/health` returns ok.
- `/health/db` returns ready.
- CORS preflight works for `https://www.vireqo.in`.
