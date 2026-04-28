# Apps Script Backend

This is the free backend option for the phone app.

## Why this is the cheapest path

- Your data already lives in Google Sheets.
- Google Apps Script can read/write that sheet directly.
- Apps Script can also send parent emails with `MailApp`.
- You can keep the frontend on GitHub Pages and point it at the Apps Script web app URL.

## Spreadsheet already wired

The default sheet ID in `Code.gs` is already set to:
- `1RnnPmQITQtevn04cMKw_PMflLr7jbAeDJ3PfXZaBDwE`

You can override it later with a Script Property named `SHEET_ID` if needed.

## Setup

1. Open your spreadsheet.
2. Go to `Extensions > Apps Script`.
3. Replace the generated `Code.gs` with the contents of `apps-script/Code.gs`.
4. Replace `appsscript.json` with `apps-script/appsscript.json`.
5. In `Project Settings > Script Properties`, add:
   - `ADMIN_KEY`: choose a new admin key
   - optional `SHEET_ID`: only if you want to override the default
   - optional `SCHOOL_NAME`
   - optional `APP_TITLE`: use `Tardy Tracker` for tardy deployments
   - optional `STUDENTS_SHEET_NAME`: use `Students` if your student tab is named `Students`
   - optional `SCANS_SHEET_NAME`: use `scan_log` if your scan tab is named `scan_log`
6. Click `Deploy > New deployment`.
7. Select `Web app`.
8. Set `Execute as` to `Me`.
9. Set access to the broadest option your Google account allows for the staff who need the app.
10. Copy the `/exec` URL.
11. Open [your GitHub Pages site](https://curtisfaughnan.github.io/NewTardyAvon/) and paste that URL into the API field.
12. Enter the same `ADMIN_KEY` in the app settings card for admin actions.

## Notes

- The frontend was updated to detect a Google Apps Script `/exec` URL automatically.
- The default admin key in `Code.gs` is still the old desktop value for compatibility. Change it in Script Properties.
- Tardy deployments automatically default to `Students` and `scan_log` when `APP_TITLE` or incident labels contain `Tardy`.
- Email sending uses `MailApp`, so your daily quota depends on your Google account type.
