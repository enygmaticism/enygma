import { getSessionUser, getPuzzleAttempt, setPuzzleAttempt } from '../_lib/auth.js';
import { readJsonFile, updateJsonFile } from '../_lib/github.js';
import { readSecurePyramids, letters } from '../_lib/pyramids.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionUser(req);
  if (!session) return res.status(401).json({ error: 'Log in to play Pyramids and save your result.' });

  try {
    const puzzleId = String(req.body?.puzzleId || '');
    const submitted = Array.isArray(req.body?.answers) ? req.body.answers.map(letters) : [];
    if (!puzzleId || !submitted.length) return res.status(400).json({ error: 'Puzzle and answers are required.' });

    const entries = await readJsonFile('data/entries.json', { pyramids: [] });
    const puzzle = (entries.data.pyramids || []).find(entry => String(entry.id) === puzzleId);
    if (!puzzle) return res.status(404).json({ error: 'Puzzle not found.' });

    const resultsFile = await readJsonFile('data/results.json', { results: [] });
    const results = Array.isArray(resultsFile.data.results) ? resultsFile.data.results : [];
    if (results.some(result => result.username === session.username && result.type === 'pyramids' && result.puzzleId === puzzleId)) {
      return res.status(409).json({ error: 'You have already played this puzzle.' });
    }

    const secure = await readSecurePyramids();
    const privatePuzzle = secure.data[puzzleId];
    if (!privatePuzzle || !Array.isArray(privatePuzzle.rows)) return res.status(500).json({ error: 'Pyramid answer data is not configured.' });
    if (submitted.length !== privatePuzzle.rows.length) return res.status(400).json({ error: 'Incorrect number of rows.' });

    const correct = privatePuzzle.rows.every((row, index) => letters(row.answer) === submitted[index]);
    const attempt = getPuzzleAttempt(req);
    const solveTimeSeconds = attempt?.type === 'pyramids' && attempt.puzzleId === puzzleId ? Math.max(0, Math.min(86400, Math.round((Date.now() - Number(attempt.startedAt || Date.now())) / 1000))) : 0;

    await updateJsonFile('data/results.json', { results: [] }, data => {
      if (!Array.isArray(data.results)) data.results = [];
      if (!data.results.some(result => result.username === session.username && result.type === 'pyramids' && result.puzzleId === puzzleId)) {
        data.results.push({
          id: `${session.username}-${puzzleId}`,
          username: session.username,
          type: 'pyramids',
          puzzleId,
          puzzleDate: String(puzzle.date),
          solveTimeSeconds,
          groupsSolved: correct ? privatePuzzle.rows.length : 0,
          completed: correct,
          score: 0,
          createdAt: new Date().toISOString()
        });
      }
      return data;
    }, `Record Pyramid result: ${session.username} / ${puzzleId}`);

    setPuzzleAttempt(res, { type: 'pyramids', puzzleId, startedAt: attempt?.startedAt || Date.now(), finished: true });

    return res.status(200).json({ ok: true, correct, solveTimeSeconds, rowsCorrect: correct ? privatePuzzle.rows.length : 0, totalRows: privatePuzzle.rows.length });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not save Pyramid result.' });
  }
}
