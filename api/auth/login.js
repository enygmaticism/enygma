import { readJsonFile } from '../_lib/github.js';
import { readUsers, verifyPassword, normalizeUsername, setSession } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GITHUB_TOKEN || !process.env.ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Account service is not configured.' });
  }

  try {
    const username = normalizeUsername(req.body?.username);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const current = await readJsonFile('data/users.secure.json', { version: 1, ciphertext: '' });
    const users = current.data.ciphertext ? (await readUsers(readJsonFile)).users : {};
    const user = users[username];

    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    setSession(res, username);
    return res.status(200).json({ ok: true, username });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not log in.' });
  }
}
