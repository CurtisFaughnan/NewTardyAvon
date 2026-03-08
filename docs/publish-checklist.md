# Publish Checklist

## 1. GitHub Pages is already live

- Frontend URL: `https://curtisfaughnan.github.io/NewTardyAvon/`
- The workflow in `.github/workflows/deploy-pages.yml` publishes the `web/` folder.

## 2. Use the free backend path

- Open your spreadsheet and go to `Extensions > Apps Script`.
- Copy in `apps-script/Code.gs` and `apps-script/appsscript.json`.
- Create a Script Property named `ADMIN_KEY` with a new secret value.
- Deploy the script as a `Web app` running as you.
- Copy the `/exec` URL from the deployment.

## 3. Connect the phone app

- Open the GitHub Pages site on your phone.
- Paste the Apps Script `/exec` URL into the API field.
- Enter the same `ADMIN_KEY` in the settings card if you need admin actions.

## 4. Optional fallback

- If you do not want to use Apps Script, the `backend/` folder is still available for a separate Node deployment.

## 5. Add it to the phone home screen

- On iPhone: `Share > Add to Home Screen`.
- On Android: browser menu > `Add to Home screen` or `Install app`.
