# Private Backend

This backend is intended to stay private while the `web/` folder is hosted from GitHub Pages.

## What it does

- Looks up students from Google Sheets
- Records scans to the `lanyard_log` sheet
- Prevents duplicate scans for the same student, section, and day
- Stores shared settings like `current_section` and `email_home_enabled`
- Queues pending parent emails and logs sent emails
- Sends parent emails through SMTP using server-side secrets

## Environment setup

1. Copy `.env.example` to `.env`.
2. Fill in the Google service account, spreadsheet reference, SMTP settings, and `ADMIN_KEY`.
3. Make sure the service account has access to the target spreadsheet.

## Run locally

```bash
cd backend
npm install
npm run dev
```

## Deploy

Any Node host that supports environment variables works. A common split is:
- GitHub Pages for `web/`
- Render, Railway, or Fly.io for `backend/`

## API routes

- `GET /api/health`
- `GET /api/bootstrap`
- `GET /api/students/:studentId`
- `POST /api/scans`
- `GET /api/pending-emails`
- `POST /api/pending-emails`
- `POST /api/pending-emails/clear` (admin)
- `DELETE /api/pending-emails/:studentId` (admin)
- `GET /api/sent-emails` (admin)
- `POST /api/send-email` (admin)
- `GET /api/settings`
- `POST /api/settings/email-home` (admin)
- `POST /api/sections/new` (admin)
- `GET /api/thresholds`
