import crypto from 'node:crypto';

const PATH = 'data/pyramids.secure.json';
const REPO = 'enygmaticism/enygma';
const GITHUB_API = 'https://api.github.com';
const DIGRAPHS = ['DŽ', 'LJ', 'NJ'];

function key() {
  const secret = process.env.ADMIN_PASSWORD || '';
  if (!secret) throw new Error('ADMIN_PASSWORD is not configured.');
  return crypto.createHash('sha256').update(`enygma-pyramids:${secret}`).digest();
}

function headers() {
  return { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' };
}

export function tokenize(value) {
  const clean = String(value || '').toUpperCase().replace(/[^A-ZČĆŽŠĐ]/g, '');
  const out = [];
  for (let i = 0; i < clean.length; i += 1) {
    const pair = clean.slice(i, i + 2);
    if (DIGRAPHS.includes(pair)) { out.push(pair); i += 1; }
    else out.push(clean[i]);
  }
  return out;
}

export function normalizeLetters(value) { return tokenize(value).join(''); }

function counts(value) {
  const result = {};
  for (const unit of tokenize(value)) result[unit] = (result[unit] || 0) + 1;
  return result;
}

export function addsExactlyOne(previous, current) {
  const prev = counts(previous), cur = counts(current);
  let added = 0;
  for (const [unit, count] of Object.entries(cur)) {
    const diff = count - (prev[unit] || 0);
    if (diff < 0) return false;
    added += diff;
  }
  for (const [unit, count] of Object.entries(prev)) if ((cur[unit] || 0) < count) return false;
  return added === 1;
}

export function validateBranch(firstAnswer, rows) {
  if (tokenize(firstAnswer).length !== 1) return 'Each first-row answer must contain exactly one Serbian letter.';
  if (!Array.isArray(rows)) return 'Branch rows are missing.';
  let previous = firstAnswer;
  for (let i = 0; i < rows.length; i += 1) {
    const answer = normalizeLetters(rows[i]?.answer);
    if (!rows[i]?.clue || !answer) return `Branch row ${i + 2} needs a clue and an answer.`;
    if (tokenize(answer).length !== i + 2) return `Branch row ${i + 2} has the wrong letter count.`;
    if (!addsExactlyOne(previous, answer)) return `Branch row ${i + 2} must contain the previous row's letters plus exactly one new letter.`;
    previous = answer;
  }
  return null;
}

export function encryptPyramids(data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString('base64');
}

export function decryptPyramids(ciphertext) {
  if (!ciphertext) return {};
  const payload = Buffer.from(ciphertext, 'base64');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(payload.length - 16);
  const body = payload.subarray(12, payload.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8'));
}

export async function readSecurePyramids() {
  const response = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${PATH}`, { headers: headers() });
  if (response.status === 404) return { data: {}, sha: null };
  if (!response.ok) throw new Error(`GitHub Pyramid read failed: ${response.status}`);
  const body = await response.json();
  const wrapper = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
  return { data: wrapper.ciphertext ? decryptPyramids(wrapper.ciphertext) : {}, sha: body.sha };
}

export async function writeSecurePyramids(data, sha, message) {
  const response = await fetch(`${GITHUB_API}/repos/${REPO}/contents/${PATH}`, {
    method: 'PUT',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`).toString('base64'), ...(sha ? { sha } : {}) })
  });
  if (!response.ok) throw new Error(`GitHub Pyramid write failed: ${response.status}`);
  return response.json();
}
