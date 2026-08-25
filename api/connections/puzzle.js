import { readJsonFile } from '../_lib/github.js';
import { getConnectionsGame, setConnectionsGame, getSessionUser } from '../_lib/auth.js';
import { getPlayerResult } from '../_lib/results.js';

const POINTS = { yellow: 100, blue: 200, green: 400, purple: 1000 };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const current = await readJsonFile('data/entries.json', { connections: [] });
    const entries = Array.isArray(current.data.connections) ? current.data.connections : [];
    const sorted = entries.slice().sort((a, b) => new Date(b.date) - new Date(a.date) || String(b.id).localeCompare(String(a.id)));
    const requestedId = String(req.query?.id || '');
    const puzzle = requestedId ? sorted.find(entry => String(entry.id) === requestedId) : sorted[0];
    if (!puzzle) return res.status(200).json({ puzzle: null, archive: [] });

    const session = getSessionUser(req);
    const priorResult = session?.username ? await getPlayerResult(session.username, 'connections', String(puzzle.id)) : null;
    if (priorResult) {
      return res.status(200).json({
        puzzle: { id: String(puzzle.id), title: String(puzzle.title || puzzle.date), date: String(puzzle.date), words: [], solvedGroups: [], gameOver: true, mistakes: 0, completed: Boolean(priorResult.completed), score: Number(priorResult.score || 0), alreadyPlayed: true },
        archive: sorted.map(entry => ({ id: String(entry.id), title: String(entry.title || entry.date), date: String(entry.date) }))
      });
    }

    let state = getConnectionsGame(req);
    if (!state || state.puzzleId !== String(puzzle.id)) {
      state = { puzzleId: String(puzzle.id), startedAt: Date.now(), mistakes: 0, solvedColors: [], gameOver: false };
      setConnectionsGame(res, state);
    }
    const groups = Array.isArray(puzzle.groups) ? puzzle.groups.map((group, index) => ({ name: String(group.name || ''), color: ['yellow', 'green', 'blue', 'purple'][index], words: Array.isArray(group.words) ? group.words.map(String).slice(0, 4) : [] })).filter(group => group.words.length === 4) : [];
    const words = groups.flatMap(group => group.words);
    const solvedGroups = state.gameOver ? groups : groups.filter(group => state.solvedColors.includes(group.color));
    const completed = state.gameOver && state.solvedColors.length === 4 && Number(state.mistakes || 0) < 4;
    const score = state.solvedColors.reduce((sum, color) => sum + (POINTS[color] || 0), 0) + (completed ? 1000 : 0);
    return res.status(200).json({ puzzle: { id: String(puzzle.id), title: String(puzzle.title || puzzle.date), date: String(puzzle.date), words, solvedGroups, gameOver: Boolean(state.gameOver), mistakes: Number(state.mistakes || 0), completed, score }, archive: sorted.map(entry => ({ id: String(entry.id), title: String(entry.title || entry.date), date: String(entry.date) })) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not load Connections.' });
  }
}
