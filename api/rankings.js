import { readJsonFile } from './_lib/github.js';

const TYPES = ['all', 'connections', 'crosswords', 'pyramids'];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const category = String(req.query?.category || 'all');
  if (!TYPES.includes(category)) return res.status(400).json({ error: 'Invalid category.' });

  try {
    const current = await readJsonFile('data/results.json', { results: [] });
    const results = Array.isArray(current.data.results) ? current.data.results : [];
    const filtered = category === 'all' ? results : results.filter(result => result.type === category);
    const byUser = new Map();

    for (const result of filtered) {
      const row = byUser.get(result.username) || { username: result.username, points: 0, solved: 0 };
      row.points += Number(result.score || 0);
      row.solved += result.completed ? 1 : 0;
      byUser.set(result.username, row);
    }

    const rankings = [...byUser.values()]
      .sort((a, b) => b.points - a.points || b.solved - a.solved || a.username.localeCompare(b.username))
      .map((row, index) => ({ rank: index + 1, ...row }));

    return res.status(200).json({ category, rankings });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not load rankings.' });
  }
}
