const GITHUB_API = 'https://api.github.com';
const DATA_PATH = 'data/entries.json';
const REPO = 'enygmaticism/enygma';

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
}

function isAllowedIp(req) {
  const allowed = String(process.env.ADMIN_IPS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return allowed.length > 0 && allowed.includes(getClientIp(req));
}

function githubHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

async function getEntries() {
  const response = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${DATA_PATH}`, {
    headers: githubHeaders()
  });
  if (!response.ok) throw new Error(`GitHub read failed: ${response.status}`);
  return response.json();
}

export default async function handler(req, res) {
  if (!isAllowedIp(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!process.env.GITHUB_TOKEN) {
    return res.status(503).json({ error: 'GitHub token is not configured.' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, title, date, content = '' } = req.body || {};
    const validTypes = ['connections', 'crosswords', 'pyramids'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid category.' });
    }
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Title is required.' });
    }
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
    }
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be text.' });
    }

    const current = await getEntries();
    const decoded = Buffer.from(current.content, 'base64').toString('utf8');
    const data = JSON.parse(decoded);
    for (const key of validTypes) {
      if (!Array.isArray(data[key])) data[key] = [];
    }

    const entry = {
      id: `${type}-${Date.now()}`,
      title: title.trim(),
      date,
      content: content.trim()
    };
    data[type].push(entry);

    const body = {
      message: `Add ${type} entry: ${entry.title}`,
      content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`).toString('base64'),
      sha: current.sha
    };

    const update = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${DATA_PATH}`, {
      method: 'PUT',
      headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
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
