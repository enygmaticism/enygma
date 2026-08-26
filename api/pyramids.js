import crypto from 'node:crypto';
import { getSessionUser } from './_lib/auth.js';
import { readJsonFile, updateJsonFile } from './_lib/github.js';
import { encryptPyramids, readSecurePyramids, writeSecurePyramids, validateBranch, tokenize, normalizeLetters } from '../lib/pyramids.js';

const ADMIN_COOKIE = 'enygma_admin';
const ATTEMPT_COOKIE = 'enygma_pyramid_attempt';
const TYPES_FALLBACK = { connections: [], crosswords: [], pyramids: [] };

function adminCookie(req) { const raw=req.headers.cookie||''; const part=raw.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${ADMIN_COOKIE}=`)); return part ? decodeURIComponent(part.slice(ADMIN_COOKIE.length+1)) : ''; }
function adminOk(req) {
  const secret=process.env.ADMIN_PASSWORD||''; if(!secret)return false;
  const expected=crypto.createHash('sha256').update(`enygma:${secret}`).digest('hex');
  const a=Buffer.from(adminCookie(req)),b=Buffer.from(expected); return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function secretKey() { const secret=process.env.ADMIN_PASSWORD||''; return crypto.createHash('sha256').update(`enygma-pyramid-attempt:${secret}`).digest(); }
function signAttempt(data) { const encoded=Buffer.from(JSON.stringify(data)).toString('base64url'); const sig=crypto.createHmac('sha256',secretKey()).update(encoded).digest('base64url'); return `${encoded}.${sig}`; }
function readAttempt(req) { try { const raw=req.headers.cookie||''; const part=raw.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${ATTEMPT_COOKIE}=`)); if(!part)return null; const token=decodeURIComponent(part.slice(ATTEMPT_COOKIE.length+1)); const [encoded,sig]=token.split('.'); if(!encoded||!sig)return null; const expected=crypto.createHmac('sha256',secretKey()).update(encoded).digest('base64url'); const a=Buffer.from(sig),b=Buffer.from(expected); if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null; const data=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8')); if(!data.exp||data.exp<Date.now())return null; return data; } catch { return null; } }
function writeAttempt(res,data) { const value=signAttempt({...data,exp:Date.now()+1000*60*60*6}); res.setHeader('Set-Cookie',`${ATTEMPT_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=21600`); }
function clearAttempt(res) { res.setHeader('Set-Cookie',`${ATTEMPT_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`); }
function noStore(res) { res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate'); res.setHeader('Pragma','no-cache'); res.setHeader('Expires','0'); }
function sortEntries(entries) { return entries.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)||String(b.id).localeCompare(String(a.id))); }
function archive(entries) { return sortEntries(entries).map(e=>({id:String(e.id),title:String(e.title||e.date),date:String(e.date),rows:Number(e.rowCount||1)})); }
function normalizeBranches(firstAnswers, rawBranches) { return firstAnswers.map((firstAnswer,index)=>({ firstAnswer: normalizeLetters(firstAnswer), rows:(rawBranches[index]?.rows||[]).map(row=>({clue:String(row?.clue||'').trim(),answer:normalizeLetters(row?.answer||''),length:tokenize(row?.answer||'').length})) })); }
function validatePuzzle(title,date,firstClue,firstAnswers,branches,rowCount) {
  if(!title)return 'Title is required.'; if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return 'Date must be YYYY-MM-DD.'; if(!firstClue)return 'The first-row clue is required.';
  if(!Array.isArray(firstAnswers)||firstAnswers.length!==2)return 'Enter exactly two possible first-row answers.';
  if(new Set(firstAnswers.map(normalizeLetters)).size!==2)return 'The two first-row answers must be different.';
  if(firstAnswers.some(a=>tokenize(a).length!==1))return 'Each first-row answer must contain exactly one Serbian letter.';
  if(!Number.isInteger(rowCount)||rowCount<1||rowCount>30)return 'The number of rows must be between 1 and 30.';
  for(let i=0;i<2;i+=1){ const branch=branches[i]; if(!branch||branch.rows.length!==rowCount-1)return `Branch ${i+1} must contain ${rowCount-1} subsequent rows.`; const error=validateBranch(firstAnswers[i],branch.rows); if(error)return `Branch ${i+1}: ${error}`; }
  return null;
}
async function readEntries(){ return readJsonFile('data/entries.json',TYPES_FALLBACK); }

async function adminHandler(req,res) {
  if(!adminOk(req))return res.status(403).json({error:'Forbidden'}); if(!process.env.GITHUB_TOKEN)return res.status(503).json({error:'GitHub token is not configured.'});
  const current=await readEntries(),data=current.data||structuredClone(TYPES_FALLBACK); if(!Array.isArray(data.pyramids))data.pyramids=[]; const secure=await readSecurePyramids(); const secureData=secure.data||{};
  if(req.method==='GET'){ const entries=data.pyramids.map(e=>{const p=secureData[String(e.id)]||{};return {...e,firstClue:p.firstClue||'',firstAnswers:p.firstAnswers||[],branches:p.branches||{},rowCount:Number(e.rowCount||1)};}); return res.status(200).json({entries}); }
  const body=req.body||{}; const title=String(body.title||'').trim(),date=String(body.date||''),firstClue=String(body.firstClue||'').trim(); const firstAnswers=Array.isArray(body.firstAnswers)?body.firstAnswers.map(normalizeLetters):[]; const rowCount=Number(body.rowCount); const raw=Array.isArray(body.branches)?body.branches:[{rows:body.branchA?.rows||[]},{rows:body.branchB?.rows||[]}]; const branches=normalizeBranches(firstAnswers,raw); const error=validatePuzzle(title,date,firstClue,firstAnswers,branches,rowCount); if(error)return res.status(400).json({error});
  if(req.method==='POST'){
    const id=`pyramids-${Date.now()}`; data.pyramids.push({id,title,date,content:'',rowCount,firstClue,length:1}); secureData[id]={rowCount,firstClue,firstAnswers,branches:Object.fromEntries(branches.map(b=>[b.firstAnswer,{rows:b.rows}]))};
    await updateJsonFile('data/entries.json',TYPES_FALLBACK,()=>data,`Add pyramids entry: ${title}`); await writeSecurePyramids({version:1,ciphertext:encryptPyramids(secureData)},secure.sha,`Secure answers: add Pyramid ${id}`); return res.status(201).json({ok:true,id});
  }
  const id=String(body.id||''); if(!id)return res.status(400).json({error:'Puzzle ID is required.'}); const index=data.pyramids.findIndex(e=>String(e.id)===id); if(index<0)return res.status(404).json({error:'Puzzle not found.'});
  if(req.method==='DELETE'){ data.pyramids.splice(index,1); delete secureData[id]; await updateJsonFile('data/entries.json',TYPES_FALLBACK,()=>data,`Delete pyramids entry: ${id}`); await writeSecurePyramids({version:1,ciphertext:encryptPyramids(secureData)},secure.sha,`Secure answers: delete Pyramid ${id}`); return res.status(200).json({ok:true}); }
  if(req.method!=='PUT'){res.setHeader('Allow','GET, POST, PUT, DELETE');return res.status(405).json({error:'Method not allowed'});}
  data.pyramids[index]={...data.pyramids[index],title,date,rowCount,firstClue,length:1,content:''}; secureData[id]={rowCount,firstClue,firstAnswers,branches:Object.fromEntries(branches.map(b=>[b.firstAnswer,{rows:b.rows}]))}; await updateJsonFile('data/entries.json',TYPES_FALLBACK,()=>data,`Edit pyramids entry: ${id}`); await writeSecurePyramids({version:1,ciphertext:encryptPyramids(secureData)},secure.sha,`Secure answers: edit Pyramid ${id}`); return res.status(200).json({ok:true});
}

async function playerGet(req,res) {
  noStore(res); const current=await readEntries(); const entries=Array.isArray(current.data.pyramids)?current.data.pyramids:[]; const sorted=sortEntries(entries); const id=String(req.query?.id||''); const puzzle=id?sorted.find(e=>String(e.id)===id):sorted[0]; if(!puzzle)return res.status(200).json({puzzle:null,archive:[]});
  const session=getSessionUser(req); const resultsFile=session?await readJsonFile('data/results.json',{results:[]}):{data:{results:[]}}; const played=session?Boolean((resultsFile.data.results||[]).some(r=>r.username===session.username&&r.type==='pyramids'&&r.puzzleId===String(puzzle.id))):false;
  if(!session)return res.status(401).json({error:'You must be logged in to play a Pyramid.'});
  if(played)return res.status(200).json({puzzle:{id:String(puzzle.id),title:String(puzzle.title||puzzle.date),date:String(puzzle.date),alreadyPlayed:true},archive:archive(entries)});
  const secure=await readSecurePyramids(); const privatePuzzle=secure.data[String(puzzle.id)]; if(!privatePuzzle)return res.status(500).json({error:'Pyramid answer data is not configured.'});
  let attempt=readAttempt(req); if(!attempt||attempt.puzzleId!==String(puzzle.id)){ attempt={puzzleId:String(puzzle.id),startedAt:Date.now(),rowIndex:0,branchKey:null,revealed:[]}; writeAttempt(res,attempt); }
  const branch=attempt.branchKey?privatePuzzle.branches?.[attempt.branchKey]:null; const currentRow=Number(attempt.rowIndex||0); const row=currentRow===0?{index:0,clue:String(privatePuzzle.firstClue||''),length:1}:branch?.rows?.[currentRow-1]||null;
  return res.status(200).json({puzzle:{id:String(puzzle.id),title:String(puzzle.title||puzzle.date),date:String(puzzle.date),alreadyPlayed:false,totalRows:Number(privatePuzzle.rowCount||puzzle.rowCount||1),currentRow,branchChosen:Boolean(attempt.branchKey),row:row?{index:currentRow,clue:String(row.clue||''),length:Number(row.length||currentRow+1)}:null,revealedRows:(attempt.revealed||[]).map((answer,index)=>({index,answer})),branchRows:branch?.rows||[]},archive:archive(entries)});
}

async function playerPost(req,res) {
  noStore(res); const session=getSessionUser(req); if(!session)return res.status(401).json({error:'You must be logged in to play a Pyramid.'}); const puzzleId=String(req.body?.puzzleId||''); const answer=normalizeLetters(req.body?.answer||''); if(!puzzleId||!answer)return res.status(400).json({error:'Answer is required.'});
  const resultsFile=await readJsonFile('data/results.json',{results:[]}); const results=Array.isArray(resultsFile.data.results)?resultsFile.data.results:[]; if(results.some(r=>r.username===session.username&&r.type==='pyramids'&&r.puzzleId===puzzleId))return res.status(409).json({error:'This is not your first time playing this puzzle, so it will not influence the ranking.'});
  const current=await readEntries(); const puzzle=(current.data.pyramids||[]).find(e=>String(e.id)===puzzleId); if(!puzzle)return res.status(404).json({error:'Pyramid not found.'}); const secure=await readSecurePyramids(); const privatePuzzle=secure.data[puzzleId]; if(!privatePuzzle)return res.status(500).json({error:'Pyramid answer data is not configured.'});
  let attempt=readAttempt(req); if(!attempt||attempt.puzzleId!==puzzleId)attempt={puzzleId,startedAt:Date.now(),rowIndex:0,branchKey:null,revealed:[]};
  const currentIndex=Number(attempt.rowIndex||0); let expected,branchKey=attempt.branchKey;
  if(currentIndex===0){ if(!privatePuzzle.firstAnswers.includes(answer))return res.status(200).json({incorrect:true}); branchKey=answer; expected=answer; }
  else { const branch=privatePuzzle.branches?.[branchKey]; const row=branch?.rows?.[currentIndex-1]; if(!row)return res.status(500).json({error:'Pyramid branch data is incomplete.'}); expected=normalizeLetters(row.answer); if(answer!==expected)return res.status(200).json({incorrect:true}); }
  const revealed=[...(attempt.revealed||[]),expected]; const totalRows=Number(privatePuzzle.rowCount||puzzle.rowCount||1); const nextIndex=currentIndex+1;
  if(nextIndex>=totalRows){ const solveTimeSeconds=Math.max(0,Math.round((Date.now()-Number(attempt.startedAt||Date.now()))/1000)); const score=totalRows*150; const record={id:`${session.username}-${puzzleId}-${Date.now()}`,username:session.username,type:'pyramids',puzzleId,puzzleDate:puzzle.date,solveTimeSeconds,rowsSolved:totalRows,completed:true,score,createdAt:new Date().toISOString()}; await updateJsonFile('data/results.json',{results:[]},data=>({results:[...(data.results||[]),record]}),`Record result: ${session.username} / pyramids / ${puzzleId}`); clearAttempt(res); return res.status(200).json({completed:true,revealedAnswers:revealed,score,solveTimeSeconds}); }
  const nextBranch=privatePuzzle.branches?.[branchKey]; const nextRow=nextBranch?.rows?.[nextIndex-1]; if(!nextRow)return res.status(500).json({error:'Pyramid branch data is incomplete.'}); const nextAttempt={...attempt,puzzleId,startedAt:Number(attempt.startedAt||Date.now()),rowIndex:nextIndex,branchKey,revealed}; writeAttempt(res,nextAttempt); return res.status(200).json({completed:false,currentRow:nextIndex,clue:String(nextRow.clue||''),length:Number(nextRow.length||nextIndex+1),branchRows:nextBranch.rows,revealedAnswers:revealed});
}

export default async function handler(req,res){
  try {
    if(req.query?.admin==='1'||req.body?.admin===true)return await adminHandler(req,res);
    if(req.method==='GET')return await playerGet(req,res);
    if(req.method==='POST')return await playerPost(req,res);
    res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'Method not allowed'});
  } catch(error){ console.error(error); return res.status(500).json({error:'Could not process Pyramid.'}); }
}
