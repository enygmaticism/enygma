import crypto from 'node:crypto';

const GITHUB_API = 'https://api.github.com';
const DATA_PATH = 'data/entries.json';
const REPO = 'enygmaticism/enygma';
const COOKIE_NAME = 'enygma_admin';

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const part = raw.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}

function isAuthenticated(req) {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const supplied = getCookie(req, COOKIE_NAME);
  if (!supplied) return false;
  const expected = crypto.createHash('sha256').update(`enygma:${secret}`).digest('hex');
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function githubHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

async function getEntries() {
  const response = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${DATA_PATH}`, { headers: githubHeaders() });
  if (!response.ok) throw new Error(`GitHub read failed: ${response.status}`);
  return response.json();
}

export default async function handler(req, res) {
  if (!isAuthenticated(req)) return res.status(403).json({ error: 'Forbidden' });
  if (!process.env.GITHUB_TOKEN) return res.status(503).json({ error: 'GitHub token is not configured.' });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, title, date, content = '' } = req.body || {};
    const validTypes = ['connections', 'crosswords', 'pyramids'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid category.' });
    if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Title is required.' });
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
    if (typeof content !== 'string') return res.status(400).json({ error: 'Content must be text.' });

    const current = await getEntries();
    const decoded = Buffer.from(current.content, 'base64').toString('utf8');
    const data = JSON.parse(decoded);
    for (const key of validTypes) if (!Array.isArray(data[key])) data[key] = [];

    const entry = {
      id: `${type}-${Date.now()}`,
      title: title.trim(),
      date,
      content: content.trim()
    };
    data[type].push(entry);

    const update = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${DATA_PATH}`, {
      method: 'PUT',
      headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Add ${type} entry: ${entry.title}`,
        content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`).toString('base64'),
        sha: current.sha
      })
    });

    if (!update.ok) {
      const detail = await update.text();
      return res.status(502).json({ error: 'GitHub write failed.', detail });
    }
    return res.status(201).json({ ok: true, entry });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
}
