import crypto from 'node:crypto';

const COOKIE_NAME = 'enygma_admin';

function tokenForSecret(secret) {
  return crypto.createHash('sha256').update(`enygma:${secret}`).digest('hex');
}

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  const part = raw.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}

function authenticated(req) {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const supplied = getCookie(req, COOKIE_NAME);
  if (!supplied) return false;
  const expected = tokenForSecret(secret);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

export default function handler(req, res) {
  noStore(res);

  if (req.method === 'GET') {
    const allowed = authenticated(req);
    return res.status(allowed ? 200 : 403).json({
      allowed,
      configuration: {
        adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD),
        githubTokenConfigured: Boolean(process.env.GITHUB_TOKEN)
      }
    });
  }

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(503).json({
      allowed: false,
      error: 'Admin password is not configured in the deployed Production environment.',
      configuration: { adminPasswordConfigured: false, githubTokenConfigured: Boolean(process.env.GITHUB_TOKEN) }
    });
  }

  if (req.method === 'POST') {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const expected = process.env.ADMIN_PASSWORD;
    const a = Buffer.from(password);
    const b = Buffer.from(expected);
    const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!valid) return res.status(401).json({ allowed: false, error: 'Incorrect password.' });

    const token = tokenForSecret(expected);
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);
    return res.status(200).json({ allowed: true });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
    return res.status(200).json({ allowed: false });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
