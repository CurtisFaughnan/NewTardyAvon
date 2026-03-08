# Web Shell

This folder contains the phone-friendly frontend intended for GitHub Pages.

## What it can do now

- Scan by student ID
- Show recent scans
- Queue pending parent emails
- Start a new section
- Toggle email-home behavior
- Send parent emails when the backend is configured
- Cache the shell for installable PWA behavior

## How it connects

Set the backend URL in the settings card after the backend is deployed. The easiest free option is a Google Apps Script web app using the `/exec` URL from your deployment. The frontend stores the API base URL and optional admin key locally in the browser.

## Files

- `index.html`: mobile UI
- `app.js`: frontend state and API calls
- `styles.css`: responsive styling
- `service-worker.js`: offline shell caching
- `manifest.webmanifest`: install metadata

