import { readJsonFile } from './_lib/github.js';
import { getConnectionsGame, setConnectionsGame, getSessionUser } from './_lib/auth.js';
import { getPlayerResult, savePlayerResult } from './_lib/results.js';

const POINTS = { yellow: 100, blue: 200, green: 400, purple: 1000 };

function groupsFor(puzzle) {
  return (Array.isArray(puzzle.groups) ? puzzle.groups : []).map((group, index) => ({
    name: String(group.name || ''),
    color: ['yellow', 'green', 'blue', 'purple'][index],
    words: Array.isArray(group.words) ? group.words.map(String).slice(0, 4) : []
  })).filter(group => group.words.length === 4);
}

async function loadPuzzle(id = '') {
  const current = await readJsonFile('data/entries.json', { connections: [] });
  const entries = Array.isArray(current.data.connections) ? current.data.connections : [];
  const sorted = entries.slice().sort((a, b) => new Date(b.date) - new Date(a.date) || String(b.id).localeCompare(String(a.id)));
  const puzzle = id ? sorted.find(entry => String(entry.id) === id) : sorted[0];
  return { puzzle, sorted };
}

export default async function handler(req, res) {
  const action = String(req.query?.action || (req.method === 'POST' ? 'guess' : 'puzzle'));
  try {
    const { puzzle, sorted } = await loadPuzzle(String(req.query?.id || req.body?.puzzleId || ''));
    if (action === 'puzzle') {
      if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
      if (!puzzle) return res.status(200).json({ puzzle: null, archive: [] });
      const session = getSessionUser(req);
      const priorResult = session?.username ? await getPlayerResult(session.username, 'connections', String(puzzle.id)) : null;
      if (priorResult) return res.status(200).json({
        puzzle: { id: String(puzzle.id), title: String(puzzle.title || puzzle.date), date: String(puzzle.date), words: [], solvedGroups: [], gameOver: true, mistakes: 0, completed: Boolean(priorResult.completed), score: Number(priorResult.score || 0), alreadyPlayed: true },
        archive: sorted.map(entry => ({ id: String(entry.id), title: String(entry.title || entry.date), date: String(entry.date) }))
      });
      let state = getConnectionsGame(req);
      if (!state || state.puzzleId !== String(puzzle.id)) {
        state = { puzzleId: String(puzzle.id), startedAt: Date.now(), mistakes: 0, solvedColors: [], gameOver: false };
        setConnectionsGame(res, state);
      }
      const groups = groupsFor(puzzle);
      const words = groups.flatMap(group => group.words);
      const solvedGroups = state.gameOver ? groups : groups.filter(group => state.solvedColors.includes(group.color));
      const completed = state.gameOver && state.solvedColors.length === 4 && Number(state.mistakes || 0) < 4;
      const score = state.solvedColors.reduce((sum, color) => sum + (POINTS[color] || 0), 0) + (completed ? 1000 : 0);
      return res.status(200).json({ puzzle: { id: String(puzzle.id), title: String(puzzle.title || puzzle.date), date: String(puzzle.date), words, solvedGroups, gameOver: Boolean(state.gameOver), mistakes: Number(state.mistakes || 0), completed, score }, archive: sorted.map(entry => ({ id: String(entry.id), title: String(entry.title || entry.date), date: String(entry.date) })) });
    }

    if (action !== 'guess') return res.status(400).json({ error: 'Invalid Connections action.' });
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
    const puzzleId = String(req.body?.puzzleId || '');
    const selected = Array.isArray(req.body?.words) ? req.body.words.map(String) : [];
    const target = puzzleId ? puzzle : null;
    if (!target) return res.status(404).json({ error: 'Puzzle not found.' });
    if (selected.length !== 4 || new Set(selected).size !== 4) return res.status(400).json({ error: 'Select exactly four words.' });
    const session = getSessionUser(req);
    if (session?.username) {
      const prior = await getPlayerResult(session.username, 'connections', puzzleId);
      if (prior) return res.status(409).json({ error: 'This is not your first time playing this puzzle, so it will not influence the ranking.', alreadyPlayed: true });
    }
    let state = getConnectionsGame(req);
    if (!state || state.puzzleId !== puzzleId) state = { puzzleId, startedAt: Date.now(), mistakes: 0, solvedColors: [], gameOver: false };
    if (state.gameOver) return res.status(409).json({ error: 'Game is already over.' });
    const groups = groupsFor(target);
    const selectedSet = new Set(selected);
    const exact = groups.find(group => !state.solvedColors.includes(group.color) && group.words.every(word => selectedSet.has(word)));
    if (exact) {
      state.solvedColors = [...state.solvedColors, exact.color];
      if (state.solvedColors.length === 4) state.gameOver = true;
      setConnectionsGame(res, state);
      let result = null;
      if (state.gameOver && session?.username) result = await savePlayerResult({ username: session.username, type: 'connections', puzzleId, puzzleDate: String(target.date), solveTimeSeconds: Math.round((Date.now() - Number(state.startedAt)) / 1000), solvedColors: state.solvedColors, completed: true });
      return res.status(200).json({ exact: true, oneAway: false, mistakes: state.mistakes, solvedColors: state.solvedColors, group: exact, gameOver: state.gameOver, completed: state.gameOver, score: result?.score ?? state.solvedColors.reduce((sum, color) => sum + (POINTS[color] || 0), 0) + (state.gameOver ? 1000 : 0) });
    }
    state.mistakes += 1;
    const oneAway = groups.some(group => !state.solvedColors.includes(group.color) && group.words.filter(word => selectedSet.has(word)).length === 3);
    if (state.mistakes >= 4) state.gameOver = true;
    setConnectionsGame(res, state);
    let result = null;
    if (state.gameOver && session?.username) result = await savePlayerResult({ username: session.username, type: 'connections', puzzleId, puzzleDate: String(target.date), solveTimeSeconds: Math.round((Date.now() - Number(state.startedAt)) / 1000), solvedColors: state.solvedColors, completed: false });
    return res.status(200).json({ exact: false, oneAway, mistakes: state.mistakes, solvedColors: state.solvedColors, gameOver: state.gameOver, answers: state.gameOver ? groups : undefined, completed: false, score: result?.score ?? state.solvedColors.reduce((sum, color) => sum + (POINTS[color] || 0), 0) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not process Connections.' });
  }
}
