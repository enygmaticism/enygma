import crypto from 'node:crypto';

const COOKIE_NAME='enygma_session';
const GAME_COOKIE_NAME='enygma_connections_game';
const ATTEMPT_COOKIE_NAME='enygma_puzzle_attempt';
const SESSION_TTL_SECONDS=60*60*24*30;
function signingKey(){const secret=process.env.ADMIN_PASSWORD||'';if(!secret)throw new Error('ADMIN_PASSWORD is not configured.');return crypto.createHash('sha256').update(`enygma-session:${secret}`).digest();}
function userDataKey(secret){if(!secret)throw new Error('User data encryption key is not configured.');return crypto.createHash('sha256').update(`enygma-user-data:${secret}`).digest();}
function primaryUserDataSecret(){return process.env.USER_DATA_KEY||process.env.GITHUB_TOKEN||'';}
function legacyUserDataSecret(){return process.env.LEGACY_USER_DATA_KEY||process.env.ADMIN_PASSWORD||'';}
function hashPassword(password,salt){return crypto.scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex');}
export function createPasswordRecord(password){const salt=crypto.randomBytes(16).toString('hex');return{salt,hash:hashPassword(password,salt)};}
export function verifyPassword(password,record){if(!record?.salt||!record?.hash)return false;const actual=Buffer.from(hashPassword(password,record.salt),'hex'),expected=Buffer.from(record.hash,'hex');return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);}
function sign(payload){const encoded=Buffer.from(JSON.stringify(payload)).toString('base64url'),signature=crypto.createHmac('sha256',signingKey()).update(encoded).digest('base64url');return`${encoded}.${signature}`;}
function verify(token){try{const[encoded,signature]=String(token||'').split('.');if(!encoded||!signature)return null;const expected=crypto.createHmac('sha256',signingKey()).update(encoded).digest('base64url'),a=Buffer.from(signature),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;const payload=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));if(!payload.exp||payload.exp<Math.floor(Date.now()/1000))return null;return payload;}catch{return null;}}
function getCookie(req,name){const raw=req.headers.cookie||'';return raw.split(';').map(value=>value.trim()).find(value=>value.startsWith(`${name}=`))?.slice(name.length+1)||'';}
export function getSessionUser(req){const session=verify(decodeURIComponent(getCookie(req,COOKIE_NAME)));return session?.username?session:null;}
export function setSession(res,username){const token=sign({kind:'session',username,exp:Math.floor(Date.now()/1000)+SESSION_TTL_SECONDS});res.setHeader('Set-Cookie',`${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`);}
export function clearSession(res){res.setHeader('Set-Cookie',`${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);}
export function getConnectionsGame(req){const state=verify(decodeURIComponent(getCookie(req,GAME_COOKIE_NAME)));return state?.kind==='connections'?state:null;}
export function setConnectionsGame(res,state){const token=sign({kind:'connections',...state,exp:Math.floor(Date.now()/1000)+60*60*12});res.setHeader('Set-Cookie',`${GAME_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`);}
export function clearConnectionsGame(res){res.setHeader('Set-Cookie',`${GAME_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);}
export function getPuzzleAttempt(req){return verify(decodeURIComponent(getCookie(req,ATTEMPT_COOKIE_NAME)));}
export function setPuzzleAttempt(res,state){const token=sign({kind:'attempt',...state,exp:Math.floor(Date.now()/1000)+60*60*12});res.setHeader('Set-Cookie',`${ATTEMPT_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`);}
export function clearPuzzleAttempt(res){res.setHeader('Set-Cookie',`${ATTEMPT_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);}
function decryptUsers(ciphertext,secret){const payload=Buffer.from(ciphertext,'base64'),iv=payload.subarray(0,12),tag=payload.subarray(payload.length-16),encrypted=payload.subarray(12,payload.length-16),decipher=crypto.createDecipheriv('aes-256-gcm',userDataKey(secret),iv);decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8'));}
export async function readUsers(readJsonFile){const current=await readJsonFile('data/users.secure.json',{version:1,ciphertext:''});if(!current.data?.ciphertext)return{users:{},sha:current.sha,keyType:'primary'};const primary=primaryUserDataSecret();if(primary){try{return{users:decryptUsers(current.data.ciphertext,primary),sha:current.sha,keyType:'primary'};}catch{}}
const legacy=legacyUserDataSecret();if(legacy){try{return{users:decryptUsers(current.data.ciphertext,legacy),sha:current.sha,keyType:'legacy'};}catch{}}
throw new Error('Could not decrypt player account data.');}
export async function migrateUsers(readJsonFile,writeJsonFile){const current=await readJsonFile('data/users.secure.json',{version:1,ciphertext:''});if(!current.data?.ciphertext)return{migrated:false};const primary=primaryUserDataSecret();if(!primary)throw new Error('No primary account-data key configured.');try{decryptUsers(current.data.ciphertext,primary);return{migrated:false,alreadyPrimary:true};}catch{}
const legacy=legacyUserDataSecret();if(!legacy)throw new Error('No legacy account-data key available.');const users=decryptUsers(current.data.ciphertext,legacy);const next={version:1,ciphertext:encryptUsers(users)};await writeJsonFile('data/users.secure.json',next,current.sha,'Migrate player account encryption');return{migrated:true,count:Object.keys(users).length};}
export function encryptUsers(users){const secret=primaryUserDataSecret();if(!secret)throw new Error('User data encryption key is not configured.');const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',userDataKey(secret),iv),ciphertext=Buffer.concat([cipher.update(JSON.stringify(users),'utf8'),cipher.final()]),tag=cipher.getAuthTag();return Buffer.concat([iv,ciphertext,tag]).toString('base64');}
export function normalizeUsername(value){return String(value||'').trim().toLowerCase();}
export function validUsername(username){return/^[a-z0-9_-]{3,20}$/.test(username);}
