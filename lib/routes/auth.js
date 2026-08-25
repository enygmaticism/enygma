import { readJsonFile, writeJsonFile } from '../github.js';
import { createPasswordRecord, encryptUsers, normalizeUsername, validUsername, readUsers, verifyPassword, setSession, clearSession, getSessionUser } from '../auth.js';

export default async function handler(req, res) {
  const action = String(req.query?.action || '').toLowerCase();
  if (action === 'login') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!process.env.GITHUB_TOKEN || !process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'Account service is not configured.' });
    try { const username=normalizeUsername(req.body?.username), password=typeof req.body?.password==='string'?req.body.password:''; const current=await readJsonFile('data/users.secure.json',{version:1,ciphertext:''}); const users=current.data.ciphertext?(await readUsers(readJsonFile)).users:{}; const user=users[username]; if(!user||!verifyPassword(password,user.password)) return res.status(401).json({error:'Invalid username or password.'}); setSession(res,username); return res.status(200).json({ok:true,username}); } catch(error){ console.error(error); return res.status(500).json({error:'Could not log in.'}); }
  }
  if (action === 'register') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!process.env.GITHUB_TOKEN || !process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'Account service is not configured.' });
    try { const username=normalizeUsername(req.body?.username), password=typeof req.body?.password==='string'?req.body.password:''; if(!validUsername(username)) return res.status(400).json({error:'Username must be 3–20 characters and use only letters, numbers, _ or -.'}); if(password.length<10)return res.status(400).json({error:'Password must be at least 10 characters.'}); const current=await readJsonFile('data/users.secure.json',{version:1,ciphertext:''}); const users=current.data.ciphertext?(await readUsers(readJsonFile)).users:{}; if(users[username])return res.status(409).json({error:'That username is already taken.'}); users[username]={username,password:createPasswordRecord(password),createdAt:new Date().toISOString()}; await writeJsonFile('data/users.secure.json',{version:1,ciphertext:encryptUsers(users)},current.sha,`Create player account: ${username}`); setSession(res,username); return res.status(201).json({ok:true,username}); } catch(error){ console.error(error); return res.status(500).json({error:'Could not create account.'}); }
  }
  if (action === 'logout') { if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'}); clearSession(res); return res.status(200).json({ok:true}); }
  if (action === 'me') { if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'}); const session=getSessionUser(req); if(!session)return res.status(401).json({authenticated:false}); return res.status(200).json({authenticated:true,username:session.username}); }
  return res.status(404).json({error:'Unknown auth action.'});
}
