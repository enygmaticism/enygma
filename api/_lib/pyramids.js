import crypto from 'node:crypto';

const PATH = 'data/pyramids.secure.json';
const REPO = 'enygmaticism/enygma';
const GITHUB_API = 'https://api.github.com';
const SERBIAN_DIGRAPHS = ['DŽ', 'LJ', 'NJ'];

function key() {
  const secret = process.env.ADMIN_PASSWORD || '';
  if (!secret) throw new Error('ADMIN_PASSWORD is not configured.');
  return crypto.createHash('sha256').update(`enygma-pyramids:${secret}`).digest();
}
function headers() { return { Accept: 'application/vnd.github+json', Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' }; }
export function tokenize(value) {
  const clean = String(value || '').toUpperCase().replace(/[^A-ZČĆŽŠĐ]/g, '');
  const out = [];
  for (let i = 0; i < clean.length; i += 1) {
    const pair = clean.slice(i, i + 2);
    if (SERBIAN_DIGRAPHS.includes(pair)) { out.push(pair); i += 1; } else out.push(clean[i]);
  }
  return out;
}
export function letters(value) { return tokenize(value).join(''); }
export function encryptPyramids(data) { const iv=crypto.randomBytes(12); const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv); const ciphertext=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]); return Buffer.concat([iv,ciphertext,cipher.getAuthTag()]).toString('base64'); }
export function decryptPyramids(ciphertext) { if(!ciphertext)return {}; const payload=Buffer.from(ciphertext,'base64'); const iv=payload.subarray(0,12), tag=payload.subarray(payload.length-16), body=payload.subarray(12,payload.length-16); const decipher=crypto.createDecipheriv('aes-256-gcm',key(),iv); decipher.setAuthTag(tag); return JSON.parse(Buffer.concat([decipher.update(body),decipher.final()]).toString('utf8')); }
export async function readSecurePyramids() { const response=await fetch(`${GITHUB_API}/repos/${REPO}/contents/${PATH}`,{headers:headers()}); if(response.status===404)return {data:{},sha:null}; if(!response.ok)throw new Error(`GitHub secure pyramid read failed: ${response.status}`); const body=await response.json(); return {data:JSON.parse(Buffer.from(body.content,'base64').toString('utf8')),sha:body.sha}; }
export async function writeSecurePyramids(data,sha,message) { const response=await fetch(`${GITHUB_API}/repos/${REPO}/contents/${PATH}`,{method:'PUT',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({message,content:Buffer.from(`${JSON.stringify(data,null,2)}\n`).toString('base64'),...(sha?{sha}:{})})}); if(!response.ok)throw new Error(`GitHub secure pyramid write failed: ${response.status} ${await response.text()}`); return response.json(); }
export function countLetters(value) { const out={}; for(const char of tokenize(value))out[char]=(out[char]||0)+1; return out; }
export function isValidPyramidRows(rows) { if(!Array.isArray(rows)||rows.length<1)return false; for(let i=0;i<rows.length;i+=1){const current=tokenize(rows[i].answer); if(current.length!==i+1)return false; if(i===0)continue; const previousCounts=countLetters(rows[i-1].answer), currentCounts=countLetters(rows[i].answer); let added=0; for(const [char,count] of Object.entries(currentCounts)){const diff=count-(previousCounts[char]||0); if(diff<0)return false; added+=diff;} if(added!==1)return false; for(const [char,count] of Object.entries(previousCounts))if((currentCounts[char]||0)<count)return false;} return true; }
