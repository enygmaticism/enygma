import crypto from 'node:crypto';
import { readJsonFile, updateJsonFile } from '../_lib/github.js';
import { readSecurePyramids, writeSecurePyramids, encryptPyramids } from '../../lib/pyramids.js';

const TYPES = ['connections', 'crosswords', 'pyramids'];
const ADMIN_COOKIE = 'enygma_admin';

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  return raw.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

function isAdmin(req) {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const supplied = decodeURIComponent(getCookie(req, ADMIN_COOKIE));
  const expected = crypto.createHash('sha256').update(`enygma:${secret}`).digest('hex');
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validateEntry(type, entry) {
  if (!TYPES.includes(type)) return 'Invalid category.';
  if (!entry || typeof entry !== 'object') return 'Invalid entry.';
  if (!String(entry.title || '').trim()) return 'Title is required.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.date || ''))) return 'Date must be YYYY-MM-DD.';
  if (type === 'connections') {
    if (!Array.isArray(entry.groups) || entry.groups.length !== 4) return 'Connections must have four groups.';
    const words = entry.groups.flatMap(group => Array.isArray(group.words) ? group.words.map(String).map(v => v.trim()) : []);
    if (entry.groups.some(group => !String(group.name || '').trim() || !Array.isArray(group.words) || group.words.length !== 4)) return 'Each Connections group needs a name and four entries.';
    if (words.length !== 16 || new Set(words.map(v => v.toLowerCase())).size !== 16) return 'Connections must contain 16 unique entries.';
  }
  return null;
}

export default async function handler(req, res) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const current = await readJsonFile('data/entries.json', { connections: [], crosswords: [], pyramids: [] });
    const data = current.data || { connections: [], crosswords: [], pyramids: [] };
    for (const type of TYPES) if (!Array.isArray(data[type])) data[type] = [];

    if (req.method === 'GET') {
      const type = String(req.query?.type || 'all');
      if (type !== 'all' && !TYPES.includes(type)) return res.status(400).json({ error: 'Invalid category.' });
      return res.status(200).json(type === 'all' ? { entries: Object.fromEntries(TYPES.map(key => [key, data[key]])) } : { entries: data[type] });
    }

    if (req.method !== 'PUT' && req.method !== 'DELETE') {
      res.setHeader('Allow', 'GET, PUT, DELETE');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const type = String(req.body?.type || '');
    const id = String(req.body?.id || '');
    if (!TYPES.includes(type) || !id) return res.status(400).json({ error: 'Category and puzzle ID are required.' });
    const index = data[type].findIndex(entry => String(entry.id) === id);
    if (index < 0) return res.status(404).json({ error: 'Puzzle not found.' });

    if (req.method === 'DELETE') {
      data[type].splice(index, 1);
      await updateJsonFile('data/entries.json', { connections: [], crosswords: [], pyramids: [] }, () => data, `Delete ${type} puzzle: ${id}`);
      if (type === 'pyramids') {
        const secure = await readSecurePyramids();
        if (Object.prototype.hasOwnProperty.call(secure.data, id)) {
          const next = { ...secure.data };
          delete next[id];
          await writeSecurePyramids({ ciphertext: encryptPyramids(next) }, secure.sha, `Delete secure pyramid: ${id}`);
        }
      }
      return res.status(200).json({ ok: true });
    }

    const updated = { ...data[type][index], ...(req.body.entry || {}), id };
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
