# Web Shell

This folder contains the phone-friendly frontend intended for GitHub Pages.

## What it can do now

- Scan by student ID or phone camera barcode scan
- Show recent scans
- Queue pending parent emails
- Start a new section
- Toggle email-home behavior
- Send parent emails when the backend is configured
- Cache the shell for installable PWA behavior
- Reuse the same frontend for separate school or program profiles

## How it connects

Set the backend URL in the settings card after the backend is deployed. The easiest free option is a Google Apps Script web app using the `/exec` URL from your deployment. The frontend stores the API base URL and optional admin key locally in the browser.

## Profile entry points

- `index.html`: Avon/default shell
- `brownsburg-high-lanyards.html`: Brownsburg High School lanyards
- `brownsburg-high-tardies.html`: Brownsburg High School tardies

## Files

- `index.html`: default mobile UI
- `brownsburg-high-lanyards.html`: Brownsburg lanyards entry page
- `brownsburg-high-tardies.html`: Brownsburg tardies entry page
- `app.js`: frontend state and API calls
- `styles.css`: responsive styling
- `service-worker.js`: offline shell caching
- `manifest.webmanifest`: default install metadata
- `manifest-brownsburg-high-lanyards.webmanifest`: Brownsburg lanyards install metadata
- `manifest-brownsburg-high-tardies.webmanifest`: Brownsburg tardies install metadata


