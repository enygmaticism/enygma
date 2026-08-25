import { updateJsonFile } from './github.js';

export async function savePlayerResult({ username, type, puzzleId, puzzleDate, solveTimeSeconds, solvedColors, completed }) {
  const POINTS = { yellow: 100, blue: 200, green: 400, purple: 1000 };
  const colors = [...new Set((solvedColors || []).filter(color => Object.hasOwn(POINTS, color)))];
  const score = colors.reduce((sum, color) => sum + POINTS[color], 0) + (completed ? 1000 : 0);
  const groupsSolved = colors.length;
  const seconds = Math.max(0, Math.min(86400, Number(solveTimeSeconds) || 0));

  await updateJsonFile(
    'data/results.json',
    { results: [] },
    data => {
      if (!Array.isArray(data.results)) data.results = [];
      const duplicate = data.results.some(result => result.username === username && result.type === type && result.puzzleId === puzzleId);
      if (!duplicate) {
        data.results.push({
          id: `${username}-${puzzleId}`,
          username,
          type,
          puzzleId,
          puzzleDate,
          solveTimeSeconds: seconds,
          groupsSolved,
          completed: Boolean(completed),
          score,
          createdAt: new Date().toISOString()
        });
      }
      return data;
    },
    `Record result: ${username} / ${type} / ${puzzleId}`
  );

  return { score, groupsSolved, completed: Boolean(completed) };
}
