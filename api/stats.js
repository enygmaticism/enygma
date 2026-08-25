import { getSessionUser } from './_lib/auth.js';
import { readJsonFile } from './_lib/github.js';

const TYPES = ['connections', 'crosswords', 'pyramids'];
const CATEGORIES = ['all', ...TYPES];

function formatSeconds(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m ${secs}s`;
}

function buildStats(username, results) {
  const stats = {};
  for (const type of TYPES) {
    const mine = results.filter(result => result.username === username && result.type === type);
    const solved = mine.filter(result => result.completed);
    const totalTime = solved.reduce((sum, result) => sum + Number(result.solveTimeSeconds || 0), 0);
    const averageTimeSeconds = solved.length ? Math.round(totalTime / solved.length) : null;
    const totalPoints = mine.reduce((sum, result) => sum + Number(result.score || 0), 0);
    const categoriesSolved = mine.reduce((sum, result) => sum + Number(result.groupsSolved || 0), 0);
    stats[type] = { solved: solved.length, averageTimeSeconds, points: totalPoints, categoriesSolved };
  }
  return stats;
}

export default async function handler(req, res) {
  const mode = String(req.query?.mode || 'rankings');
  try {
    const current = await readJsonFile('data/results.json', { results: [] });
    const results = Array.isArray(current.data.results) ? current.data.results : [];

    if (mode === 'profile') {
      const session = getSessionUser(req);
      if (!session) return res.status(401).json({ error: 'You must be logged in.' });
      const mine = results.filter(result => result.username === session.username).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json({ username: session.username, stats: buildStats(session.username, results), results: mine });
    }

    if (mode !== 'rankings') return res.status(400).json({ error: 'Invalid stats mode.' });
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
    const category = String(req.query?.category || 'all');
    if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category.' });
    const filtered = category === 'all' ? results : results.filter(result => result.type === category);
    const byUser = new Map();
    for (const result of filtered) {
      const row = byUser.get(result.username) || { username: result.username, points: 0, solved: 0, totalTimeSeconds: 0 };
      row.points += Number(result.score || 0);
      row.solved += result.completed ? 1 : 0;
      row.totalTimeSeconds += Math.max(0, Number(result.solveTimeSeconds) || 0);
      byUser.set(result.username, row);
    }
    const rankings = [...byUser.values()]
      .sort((a, b) => b.points - a.points || b.solved - a.solved || a.totalTimeSeconds - b.totalTimeSeconds || a.username.localeCompare(b.username))
      .map((row, index) => ({ rank: index + 1, ...row, averageTime: row.solved ? formatSeconds(row.totalTimeSeconds / row.solved) : '—', totalTime: formatSeconds(row.totalTimeSeconds) }));
    return res.status(200).json({ category, rankings });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: mode === 'profile' ? 'Could not load profile.' : 'Could not load rankings.' });
  }
}
