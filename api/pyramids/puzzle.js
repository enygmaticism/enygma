import { getSessionUser, getPuzzleAttempt, setPuzzleAttempt } from '../_lib/auth.js';
import { readJsonFile } from '../_lib/github.js';
import { readSecurePyramids } from '../_lib/pyramids.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const current = await readJsonFile('data/entries.json', { pyramids: [] });
    const entries = Array.isArray(current.data.pyramids) ? current.data.pyramids : [];
    const sorted = entries.slice().sort((a, b) => new Date(b.date) - new Date(a.date) || String(b.id).localeCompare(String(a.id)));
    const requestedId = String(req.query?.id || '');
    const puzzle = requestedId ? sorted.find(entry => String(entry.id) === requestedId) : sorted[0];
    if (!puzzle) return res.status(200).json({ puzzle: null, archive: [] });

    const session = getSessionUser(req);
    const existing = session ? await readJsonFile('data/results.json', { results: [] }) : { data: { results: [] } };
    const played = session ? (existing.data.results || []).some(result => result.username === session.username && result.type === 'pyramids' && result.puzzleId === String(puzzle.id)) : false;

    const attempt = getPuzzleAttempt(req);
    const sameAttempt = attempt?.type === 'pyramids' && attempt?.puzzleId === String(puzzle.id) && !attempt?.finished;
    if (session && !played && !sameAttempt) {
      setPuzzleAttempt(res, { type: 'pyramids', puzzleId: String(puzzle.id), startedAt: Date.now(), finished: false });
    }

    const secure = await readSecurePyramids();
    const privatePuzzle = secure.data[String(puzzle.id)];
    const rows = Array.isArray(puzzle.rows) ? puzzle.rows.map((row, index) => ({ clue: String(row.clue || ''), length: Number(row.length || index + 1) })) : [];

    return res.status(200).json({
      puzzle: {
        id: String(puzzle.id), title: String(puzzle.title || puzzle.date), date: String(puzzle.date),
        rows, alreadyPlayed: played, requiresLoginToSave: true,
        totalRows: rows.length,
        hasSecureAnswerData: Boolean(privatePuzzle)
      },
      archive: sorted.map(entry => ({ id: String(entry.id), title: String(entry.title || entry.date), date: String(entry.date), rows: Array.isArray(entry.rows) ? entry.rows.length : 0 }))
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not load Pyramid.' });
  }
}
