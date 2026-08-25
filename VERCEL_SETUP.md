# Vercel setup

The Enygma site can be deployed directly from this GitHub repository on Vercel.

## Environment variables

Set these in the Vercel project for Production:

- `GITHUB_TOKEN` — a GitHub fine-grained personal access token with **Contents: Read and write** access to `enygmaticism/enygma`.
- `ADMIN_PASSWORD` — the private password for the Enygma admin page.

No IP allowlist is required.

The player-account encryption key is derived server-side from the existing `ADMIN_PASSWORD` and `GITHUB_TOKEN`, so there is no third secret to configure.

After changing either variable, redeploy the project.

## Admin

Open `/admin.html`. The admin password is checked by a serverless function. The GitHub token is used only on the server and is never sent to the browser.

## Player accounts

Open `/login.html` to create an account or log in. Passwords are salted and hashed with Node's `scrypt` and the entire credential database is encrypted before being committed to `data/users.secure.json`.

Player results are stored separately in `data/results.json`. They contain usernames, puzzle results, solving times, group counts, and points — not passwords.

Profiles are available at `/profile.html` and leaderboards at `/rankings.html`.
