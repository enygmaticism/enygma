import { getSessionUser } from './_lib/auth.js';
import { readJsonFile, updateJsonFile } from './_lib/github.js';

const POINTS = { yellow: 100, blue: 200, green: 400, purple: 1000 };
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
    stats[type] = {
      solved: solved.length,
      averageTimeSeconds,
      points: totalPoints,
      categoriesSolved
    };
  }
  return stats;
}

export default async function handler(req, res) {
  const session = getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'You must be logged in.' });

  if (req.method === 'GET') {
    try {
      const current = await readJsonFile('data/results.json', { results: [] });
      const results = Array.isArray(current.data.results) ? current.data.results : [];
      const mine = results
        .filter(result => result.username === session.username)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.status(200).json({ username: session.username, stats: buildStats(session.username, results), results: mine });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Could not load profile.' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, puzzleId, puzzleDate, solveTimeSeconds, solvedColors, completed } = req.body || {};
    if (!TYPES.includes(type) || typeof puzzleId !== 'string' || typeof puzzleDate !== 'string') {
      return res.status(400).json({ error: 'Invalid result.' });
    }

    const colors = Array.isArray(solvedColors) ? [...new Set(solvedColors.filter(color => Object.prototype.hasOwnProperty.call(POINTS, color)))] : [];
    const groupsSolved = colors.length;
    const score = colors.reduce((sum, color) => sum + POINTS[color], 0) + (completed ? 1000 : 0);
    const seconds = Math.max(0, Math.min(86400, Number(solveTimeSeconds) || 0));

    await updateJsonFile(
      'data/results.json',
      { results: [] },
      data => {
        if (!Array.isArray(data.results)) data.results = [];
        const duplicate = data.results.some(result => result.username === session.username && result.type === type && result.puzzleId === puzzleId);
        if (duplicate) return data;
        data.results.push({
          id: `${session.username}-${puzzleId}`,
          username: session.username,
          type,
          puzzleId,
          puzzleDate,
          solveTimeSeconds: seconds,
          groupsSolved,
          completed: Boolean(completed),
          score,
          createdAt: new Date().toISOString()
        });
        return data;
      },
      `Record result: ${session.username} / ${type} / ${puzzleId}`
    );

    return res.status(201).json({ ok: true, score, groupsSolved, completed: Boolean(completed) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not save result.' });
  }
}
