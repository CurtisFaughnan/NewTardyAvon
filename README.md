# NewTardyAvon

Lanyard Tracker rewritten for phone access with a GitHub Pages frontend and a free Google Apps Script backend option.

This repo has three tracks:
- `Lanyard/`: the extracted legacy desktop app source.
- `web/`: the phone-friendly PWA shell for GitHub Pages.
- `apps-script/`: the free backend that reads and writes your Google Sheet directly.
- `backend/`: the private Node API if you want a separate server later.

Important:
- The original Windows `.exe` cannot run on phones as-is.
- The easiest free setup is `GitHub Pages frontend + Google Apps Script web app`.
- Secret files stay out of Git through ignore rules and local config.

References:
- Free hosting checklist: `docs/publish-checklist.md`
- Apps Script setup: `apps-script/README.md`
- Mobile migration notes: `docs/mobile-migration.md`
- Optional Node backend setup: `backend/README.md`
