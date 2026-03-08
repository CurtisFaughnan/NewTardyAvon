# Mobile Migration Notes

## Current state

The existing app in `Lanyard/Lanyard_test_file.py` is a desktop-only Python/Tkinter program packaged with PyInstaller.

Key blockers for phone support:
- `tkinter` windows and dialogs require a desktop GUI.
- `winsound` is Windows-only.
- The update flow downloads and replaces a Windows `.exe`.
- Google and Gmail credentials are stored as local files and cannot be exposed in a public frontend.
- The app relies on local JSON/XLSX files for offline storage and settings.

## Recommended target

The cleanest phone-ready version is a mobile-friendly web app:
- Frontend: PWA hosted on GitHub Pages.
- Backend: a private API that talks to Google Sheets and Gmail.

Because the app already depends on Google Sheets/Gmail, Google Apps Script is the most direct backend option. It can:
- read student records
- append scan logs
- manage thresholds
- queue/send parent emails
- keep credentials off GitHub Pages

## Suggested migration order

1. Keep the existing desktop app as the reference implementation.
2. Move secret values to local config only and keep credential files out of Git.
3. Build an API around the current workflows:
   - lookup student by ID
   - submit scan
   - start new section
   - read/update thresholds
   - list pending emails
   - send email
4. Build a mobile-first frontend that calls that API.
5. Deploy the frontend through GitHub Pages and keep the backend private.

## Feature inventory to preserve

- Student lookup and scan logging
- Section resets / duplicate protection
- Tier thresholds and color labels
- Pending parent email review
- Sent email log
- Student creation
- Offline retry behavior

## Immediate recommendation

Do not try to upload the `.exe` to GitHub for phone use. Treat the current codebase as the source to rewrite into a PWA.
