## Brownsburg High School Setup

This repo can now serve Brownsburg High School as two separate phone apps without duplicating the codebase.

The imported Brownsburg desktop build in `Brownsburg High 1.0.2.zip` uses:

- Spreadsheet title: `Brownsburg_High_School_Lanyard_Data`
- School name: `Brownsburg Community School Corporation`
- Lanyard tiers: `1-4`, `5-9`, `10-14`, `15+`

### Live links

- Lanyards: `https://curtisfaughnan.github.io/NewTardyAvon/brownsburg-high-lanyards.html`
- Tardies: `https://curtisfaughnan.github.io/NewTardyAvon/brownsburg-high-tardies.html`

### Recommended structure

Create two separate Google Sheets and two separate Apps Script deployments:

1. Brownsburg High School Lanyards
2. Brownsburg High School Tardies

That keeps thresholds, scan history, sections, and pending emails fully separate.

### Apps Script properties for Brownsburg lanyards

- `SHEET_ID` = optional if you create the Apps Script from inside the Brownsburg lanyards spreadsheet
- `SCHOOL_NAME` = `Brownsburg High School`
- `APP_TITLE` = `Lanyard Tracker`
- `COUNT_LABEL` = `Total lanyard violations`
- `INCIDENT_SINGULAR` = `lanyard violation`
- `INCIDENT_PLURAL` = `lanyard violations`
- `ADMIN_KEY` = your Brownsburg lanyards admin key

Recommended threshold rows for Brownsburg lanyards:

- `Tier 1`: `1` to `4`
- `Tier 2`: `5` to `9`
- `Tier 3`: `10` to `14`
- `Tier 4`: `15` to `9999`

### Apps Script properties for Brownsburg tardies

- `SHEET_ID` = spreadsheet id for the Brownsburg tardies sheet
- `SCHOOL_NAME` = `Brownsburg High School`
- `APP_TITLE` = `Tardy Tracker`
- `COUNT_LABEL` = `Total tardies`
- `INCIDENT_SINGULAR` = `tardy`
- `INCIDENT_PLURAL` = `tardies`
- `ADMIN_KEY` = your Brownsburg tardies admin key

### What to paste into each Apps Script project

- `apps-script/Code.gs`
- `apps-script/appsscript.json`

### Final hookup

1. Deploy each Apps Script project as its own web app.
2. Open the matching Brownsburg phone page.
3. Paste that deployment's `/exec` URL into `API base URL`.
4. Paste the matching `ADMIN_KEY`.
5. Tap `Refresh backend`.

### Notes

- Threshold colors, tiers, section resets, and duplicate-per-day protection stay separate per backend.
- The two Brownsburg pages share the same frontend code, so future fixes only need to be shipped once.
- The Brownsburg phone pages now use the bulldog branding extracted from the legacy Brownsburg desktop app.
