# Vercel setup

The Enygma site can be deployed directly from this GitHub repository on Vercel.

## Environment variables

Set these in the Vercel project for Production (and Preview only if desired):

- `GITHUB_TOKEN` — a GitHub fine-grained personal access token with **Contents: Read and write** access to `enygmaticism/enygma`.
- `ADMIN_IPS` — your public IP address. Multiple allowed IPs can be separated by commas.

After adding or changing either variable, redeploy the project.

## Admin

Open `/admin`. There is no password. The API checks the request IP against `ADMIN_IPS` before allowing an entry to be committed to `data/entries.json`.

The GitHub token is used only by the serverless function and is never sent to the browser.
