function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
}

function getAllowedIps() {
  return String(process.env.ADMIN_IPS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const allowedIps = getAllowedIps();
  if (!allowedIps.length) {
    return res.status(503).json({
      allowed: false,
      error: 'Admin IP is not configured yet.'
    });
  }

  const ip = getClientIp(req);
  const allowed = allowedIps.includes(ip);
  return res.status(allowed ? 200 : 403).json({ allowed });
}
