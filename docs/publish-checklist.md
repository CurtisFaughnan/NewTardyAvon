# Publish Checklist

## 1. Push this repo to GitHub

- Create a new GitHub repository.
- Add it as the remote for this local repo.
- Push the contents of this folder to the `main` branch.

## 2. Turn on GitHub Pages

- In GitHub, open `Settings > Pages`.
- Set the source to `GitHub Actions`.
- The workflow in `.github/workflows/deploy-pages.yml` will publish the `web/` folder.

## 3. Deploy the backend

- Copy `backend/.env.example` to `backend/.env` for local testing.
- Fill in the Google service account, spreadsheet reference, SMTP settings, and admin key.
- Deploy `backend/` to a Node host such as Render, Railway, or Fly.io.

## 4. Point the phone app at the backend

- Open the GitHub Pages site on your phone.
- Enter the backend base URL in the settings card.
- Enter the admin key if you need admin actions like new section, clearing pending emails, or sending email.

## 5. Add it to the phone home screen

- On iPhone: Share > Add to Home Screen.
- On Android: browser menu > Add to Home screen or Install app.
