import { updateJsonFile, readJsonFile } from './github.js';

const POINTS = { yellow: 100, blue: 200, green: 400, purple: 1000 };

export async function getPlayerResult(username, type, puzzleId) {
  const current = await readJsonFile('data/results.json', { results: [] });
  const results = Array.isArray(current.data.results) ? current.data.results : [];
  return results.find(result => result.username === username && result.type === type && result.puzzleId === puzzleId) || null;
}

export async function savePlayerResult({ username, type, puzzleId, puzzleDate, solveTimeSeconds, solvedColors, completed, scoreOverride = null }) {
  const colors = [...new Set((solvedColors || []).filter(color => Object.hasOwn(POINTS, color)))];
  const score = scoreOverride == null ? colors.reduce((sum, color) => sum + POINTS[color], 0) + (completed ? 1000 : 0) : Number(scoreOverride);
  const groupsSolved = colors.length;
  const seconds = Math.max(0, Math.min(86400, Number(solveTimeSeconds) || 0));
  let saved = true;
  await updateJsonFile('data/results.json',{ results: [] },data=>{
    if (!Array.isArray(data.results)) data.results=[];
    const duplicate=data.results.some(result=>result.username===username&&result.type===type&&result.puzzleId===puzzleId);
    if (duplicate){saved=false;return data;}
    data.results.push({id:`${username}-${puzzleId}`,username,type,puzzleId,puzzleDate,solveTimeSeconds:seconds,groupsSolved,completed:Boolean(completed),score,createdAt:new Date().toISOString()});
    return data;
  },`Record result: ${username} / ${type} / ${puzzleId}`);
  return {score,groupsSolved,completed:Boolean(completed),saved};
}
