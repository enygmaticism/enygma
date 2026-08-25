import crypto from 'node:crypto';

const COOKIE_NAME = 'enygma_session';
const GAME_COOKIE_NAME = 'enygma_connections_game';
const ATTEMPT_COOKIE_NAME = 'enygma_puzzle_attempt';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function secretKey() {
  const secret = process.env.ADMIN_PASSWORD || '';
  if (!secret) throw new Error('ADMIN_PASSWORD is not configured.');
  return crypto.createHash('sha256').update(`enygma-user-data:${secret}`).digest();
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
}

export function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: hashPassword(password, salt) };
}

export function verifyPassword(password, record) {
  if (!record?.salt || !record?.hash) return false;
  const actual = Buffer.from(hashPassword(password, record.salt), 'hex');
  const expected = Buffer.from(record.hash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function sign(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secretKey()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verify(token) {
  try {
    const [encoded, signature] = String(token || '').split('.');
    if (!encoded || !signature) return null;
    const expected = crypto.createHmac('sha256', secretKey()).update(encoded).digest('base64url');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  return raw.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

export function getSessionUser(req) {
  const session = verify(decodeURIComponent(getCookie(req, COOKIE_NAME)));
  return session?.username ? session : null;
}

export function setSession(res, username) {
  const token = sign({ kind: 'session', username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function getConnectionsGame(req) {
  const state = verify(decodeURIComponent(getCookie(req, GAME_COOKIE_NAME)));
  return state?.kind === 'connections' ? state : null;
}

export function setConnectionsGame(res, state) {
  const token = sign({ kind: 'connections', ...state, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 });
  res.setHeader('Set-Cookie', `${GAME_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`);
}

export function clearConnectionsGame(res) {
  res.setHeader('Set-Cookie', `${GAME_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function getPuzzleAttempt(req) {
  return verify(decodeURIComponent(getCookie(req, ATTEMPT_COOKIE_NAME)));
}

export function setPuzzleAttempt(res, state) {
  const token = sign({ kind: 'attempt', ...state, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12 });
  res.setHeader('Set-Cookie', `${ATTEMPT_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`);
}

export function clearPuzzleAttempt(res) {
  res.setHeader('Set-Cookie', `${ATTEMPT_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export async function readUsers(readJsonFile) {
  const { data } = await readJsonFile('data/users.secure.json', { version: 1, ciphertext: '' });
  if (!data.ciphertext) return { users: {}, sha: null };
  const payload = Buffer.from(data.ciphertext, 'base64');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(payload.length - 16);
  const ciphertext = payload.subarray(12, payload.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return { users: JSON.parse(plaintext), sha: null };
}

export function encryptUsers(users) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(users), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, tag]).toString('base64');
}

export function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

export function validUsername(username) {
  return /^[a-z0-9_-]{3,20}$/.test(username);
}
