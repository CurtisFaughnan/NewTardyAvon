# Lanyard Tracker

This repo now has two tracks:
- `Lanyard/`: the extracted legacy desktop app source.
- `web/`: the phone-friendly PWA shell for GitHub Pages.
- `backend/`: the private API that talks to Google Sheets and sends email.

Important:
- The original Windows `.exe` cannot run on phones as-is.
- The phone version is now structured as `GitHub Pages frontend + private backend`.
- Secret files stay out of Git through ignore rules and local config.

References:
- Publish checklist: `docs/publish-checklist.md`
- Mobile migration notes: `docs/mobile-migration.md`
- Backend setup: `backend/README.md`
