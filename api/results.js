import { getSessionUser } from './_lib/auth.js';
import { readJsonFile } from './_lib/github.js';

const TYPES = ['connections', 'crosswords', 'pyramids'];

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
  const session = getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'You must be logged in.' });

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Results are recorded by the game server.' });
  }

  try {
    const current = await readJsonFile('data/results.json', { results: [] });
    const results = Array.isArray(current.data.results) ? current.data.results : [];
    const mine = results.filter(result => result.username === session.username).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ username: session.username, stats: buildStats(session.username, results), results: mine });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not load profile.' });
  }
}
