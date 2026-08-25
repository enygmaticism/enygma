# Vercel setup

The Enygma site can be deployed directly from this GitHub repository on Vercel.

## Environment variables

Set these in the Vercel project for Production (and Preview only if desired):

- `GITHUB_TOKEN` — a GitHub fine-grained personal access token with **Contents: Read and write** access to `enygmaticism/enygma`.
- `ADMIN_PASSWORD` — the password you choose for the Enygma admin area.

After adding or changing either variable, redeploy the project.

## Admin

Open `/admin.html`. The API verifies the password server-side and then issues an HTTP-only session cookie. The password is never stored in the repository or sent to GitHub.

The GitHub token is used only by the serverless functions and is never sent to the browser.

## Connections

Connections entries contain exactly four categories with exactly four unique words in each category. The four categories are displayed in this order: yellow, green, blue, purple, matching the game's difficulty order from easiest to hardest. The live game uses the latest dated Connections entry and the archive lists previous entries.
