## Another School Setup

This version is set up so a second school can reuse the same phone site with a new Google Sheet and Apps Script deployment.

### Fast path

1. Copy the Google Sheet for the new school.
2. Open the new sheet and create a new Apps Script project from it.
3. Paste in:
   - `apps-script/Code.gs`
   - `apps-script/appsscript.json`
4. In Apps Script `Project Settings > Script Properties`, set:
   - `SHEET_ID` = the new spreadsheet ID
   - `SCHOOL_NAME` = the new school name
   - `ADMIN_KEY` = a new admin password
5. Deploy the Apps Script web app and copy the new `/exec` URL.
6. Open the phone site and paste in:
   - the new `/exec` URL
   - the new `ADMIN_KEY`

### Optional school-specific changes

- Replace `web/assets/Avon_Crest.png` with the other school's crest if you want different branding.
- If you want a separate GitHub Pages URL for that school, fork or duplicate the repo and deploy it separately.

### What is already reusable

- The phone UI can now read the school name from the backend.
- Thresholds are editable from Admin settings and stored in the sheet.
- Daily duplicate protection and section resets are handled per backend deployment.
