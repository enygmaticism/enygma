import { readJsonFile } from '../_lib/github.js';
import { getConnectionsGame, setConnectionsGame } from '../_lib/auth.js';
import { getSessionUser } from '../_lib/auth.js';
import { savePlayerResult } from '../_lib/results.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const current = await readJsonFile('data/entries.json', { connections: [] });
    const entries = Array.isArray(current.data.connections) ? current.data.connections : [];
    const puzzleId = String(req.body?.puzzleId || '');
    const selected = Array.isArray(req.body?.words) ? req.body.words.map(String) : [];
    const puzzle = entries.find(entry => String(entry.id) === puzzleId);
    if (!puzzle) return res.status(404).json({ error: 'Puzzle not found.' });
    if (selected.length !== 4 || new Set(selected).size !== 4) return res.status(400).json({ error: 'Select exactly four words.' });

    let state = getConnectionsGame(req);
    if (!state || state.puzzleId !== puzzleId) {
      state = { puzzleId, startedAt: Date.now(), mistakes: 0, solvedColors: [], gameOver: false };
    }
    if (state.gameOver) return res.status(409).json({ error: 'Game is already over.' });

    const groups = (Array.isArray(puzzle.groups) ? puzzle.groups : []).map((group, index) => ({
      name: String(group.name || ''),
      color: ['yellow', 'green', 'blue', 'purple'][index],
      words: Array.isArray(group.words) ? group.words.map(String).slice(0, 4) : []
    })).filter(group => group.words.length === 4);

    const selectedSet = new Set(selected);
    const exact = groups.find(group => !state.solvedColors.includes(group.color) && group.words.length === 4 && group.words.every(word => selectedSet.has(word)));

    if (exact) {
      state.solvedColors = [...state.solvedColors, exact.color];
      if (state.solvedColors.length === 4) state.gameOver = true;
      setConnectionsGame(res, state);

      let result = null;
      const session = getSessionUser(req);
      if (state.gameOver && session?.username) {
        result = await savePlayerResult({
          username: session.username,
          type: 'connections',
          puzzleId,
          puzzleDate: String(puzzle.date),
          solveTimeSeconds: Math.round((Date.now() - Number(state.startedAt)) / 1000),
          solvedColors: state.solvedColors,
          completed: true
        });
      }

      return res.status(200).json({
        exact: true,
        oneAway: false,
        mistakes: state.mistakes,
        solvedColors: state.solvedColors,
        group: exact,
        gameOver: state.gameOver,
        completed: state.gameOver,
        score: result?.score ?? state.solvedColors.reduce((sum, color) => sum + ({ yellow: 100, blue: 200, green: 400, purple: 1000 }[color] || 0), 0) + 1000
      });
    }

    state.mistakes += 1;
    const oneAway = groups.some(group => !state.solvedColors.includes(group.color) && group.words.filter(word => selectedSet.has(word)).length === 3);
    if (state.mistakes >= 4) state.gameOver = true;
    setConnectionsGame(res, state);

    let result = null;
    const session = getSessionUser(req);
    if (state.gameOver && session?.username) {
      result = await savePlayerResult({
        username: session.username,
        type: 'connections',
        puzzleId,
        puzzleDate: String(puzzle.date),
        solveTimeSeconds: Math.round((Date.now() - Number(state.startedAt)) / 1000),
        solvedColors: state.solvedColors,
        completed: false
      });
    }

    return res.status(200).json({
      exact: false,
      oneAway,
      mistakes: state.mistakes,
      solvedColors: state.solvedColors,
      gameOver: state.gameOver,
      answers: state.gameOver ? groups : undefined,
      completed: false,
      score: result?.score ?? state.solvedColors.reduce((sum, color) => sum + ({ yellow: 100, blue: 200, green: 400, purple: 1000 }[color] || 0), 0)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not submit guess.' });
  }
}
