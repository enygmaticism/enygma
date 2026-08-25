import { createPasswordRecord, encryptUsers, normalizeUsername, validUsername } from '../_lib/auth.js';
import { readJsonFile, writeJsonFile } from '../_lib/github.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.GITHUB_TOKEN || !process.env.USER_DATA_KEY) {
    return res.status(503).json({ error: 'Account service is not configured.' });
  }

  try {
    const username = normalizeUsername(req.body?.username);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!validUsername(username)) return res.status(400).json({ error: 'Username must be 3–20 characters and use only letters, numbers, _ or -.' });
    if (password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters.' });

    const current = await readJsonFile('data/users.secure.json', { version: 1, ciphertext: '' });
    let users = {};
    if (current.data.ciphertext) {
      const { readUsers } = await import('../_lib/auth.js');
      users = (await readUsers(readJsonFile)).users;
    }
    if (users[username]) return res.status(409).json({ error: 'That username is already taken.' });

    users[username] = {
      username,
      password: createPasswordRecord(password),
      createdAt: new Date().toISOString()
    };

    const data = { version: 1, ciphertext: encryptUsers(users) };
    await writeJsonFile('data/users.secure.json', data, current.sha, `Create player account: ${username}`);
    return res.status(201).json({ ok: true, username });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not create account.' });
  }
}
