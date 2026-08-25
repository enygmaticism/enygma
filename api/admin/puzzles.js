import { getSessionUser } from '../_lib/auth.js';
import { readJsonFile, updateJsonFile } from '../_lib/github.js';

const TYPES = ['connections', 'crosswords', 'pyramids'];

function requireAdmin(req) {
  const session = getSessionUser(req);
  return session?.kind === 'admin' ? session : null;
}

function validateEntry(type, entry) {
  if (!TYPES.includes(type)) return 'Invalid category.';
  if (!entry || typeof entry !== 'object') return 'Invalid entry.';
  if (!String(entry.title || '').trim()) return 'Title is required.';
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(entry.date || ''))) return 'Date must be YYYY-MM-DD.';
  if (type === 'connections') {
    if (!Array.isArray(entry.groups) || entry.groups.length !== 4) return 'Connections must have four groups.';
    const words = entry.groups.flatMap(group => Array.isArray(group.words) ? group.words.map(String).map(v => v.trim()) : []);
    if (entry.groups.some(group => !String(group.name || '').trim() || !Array.isArray(group.words) || group.words.length !== 4)) return 'Each Connections group needs a name and four entries.';
    if (words.length !== 16 || new Set(words.map(v => v.toLowerCase())).size !== 16) return 'Connections must contain 16 unique entries.';
  }
  return null;
}

export default async function handler(req, res) {
  if (!requireAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const current = await readJsonFile('data/entries.json', { connections: [], crosswords: [], pyramids: [] });
    const data = current.data || { connections: [], crosswords: [], pyramids: [] };
    for (const type of TYPES) if (!Array.isArray(data[type])) data[type] = [];

    if (req.method === 'GET') {
      const type = String(req.query?.type || 'all');
      if (type !== 'all' && !TYPES.includes(type)) return res.status(400).json({ error: 'Invalid category.' });
      if (type === 'all') return res.status(200).json({ entries: Object.fromEntries(TYPES.map(key => [key, data[key]])) });
      return res.status(200).json({ entries: data[type] });
    }

    if (req.method !== 'PUT' && req.method !== 'DELETE') {
      res.setHeader('Allow', 'GET, PUT, DELETE');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const type = String(req.body?.type || req.query?.type || '');
    const id = String(req.body?.id || req.query?.id || '');
    if (!TYPES.includes(type) || !id) return res.status(400).json({ error: 'Category and puzzle ID are required.' });
    const index = data[type].findIndex(entry => String(entry.id) === id);
    if (index < 0) return res.status(404).json({ error: 'Puzzle not found.' });

    if (req.method === 'DELETE') {
      data[type].splice(index, 1);
      await updateJsonFile('data/entries.json', { connections: [], crosswords: [], pyramids: [] }, () => data, `Delete ${type} puzzle: ${id}`);
      return res.status(200).json({ ok: true });
    }

    const updated = { ...data[type][index], ...(req.body.entry || {}) , id };
    const error = validateEntry(type, updated);
    if (error) return res.status(400).json({ error });
    data[type][index] = updated;
    await updateJsonFile('data/entries.json', { connections: [], crosswords: [], pyramids: [] }, () => data, `Edit ${type} puzzle: ${id}`);
    return res.status(200).json({ ok: true, entry: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not manage puzzles.' });
  }
}
