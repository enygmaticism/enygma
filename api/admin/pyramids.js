import crypto from 'node:crypto';
import { readJsonFile, updateJsonFile } from '../_lib/github.js';
import { encryptPyramids, readSecurePyramids, writeSecurePyramids, isValidPyramidRows, letters, tokenize } from '../_lib/pyramids.js';

function cookie(req) { const raw=req.headers.cookie||''; const part=raw.split(';').map(v=>v.trim()).find(v=>v.startsWith('enygma_admin=')); return part ? decodeURIComponent(part.slice('enygma_admin='.length)) : ''; }
function isAdmin(req) { const secret=process.env.ADMIN_PASSWORD||''; if(!secret)return false; const expected=crypto.createHash('sha256').update(`enygma:${secret}`).digest('hex'); const supplied=cookie(req); const a=Buffer.from(supplied),b=Buffer.from(expected); return a.length===b.length&&crypto.timingSafeEqual(a,b); }
function normalizeRows(rows) { if(!Array.isArray(rows))return []; return rows.map((row,index)=>({clue:String(row?.clue||'').trim(),answer:letters(row?.answer||''),length:index+1})); }
function validate(title,date,rows) { if(!title)return 'Title is required.'; if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return 'Date must be YYYY-MM-DD.'; if(!rows.length)return 'Add at least one row.'; if(rows.some(row=>!row.clue||tokenize(row.answer).length!==row.length))return 'Every row needs a clue and an answer with the correct Serbian-letter length.'; if(!isValidPyramidRows(rows))return "Each row must contain the previous row's letters plus exactly one new letter."; return null; }
async function publicData(){ return readJsonFile('data/entries.json',{connections:[],crosswords:[],pyramids:[]}); }
export default async function handler(req,res){
  if(!isAdmin(req))return res.status(403).json({error:'Forbidden'});
  if(!process.env.GITHUB_TOKEN)return res.status(503).json({error:'GitHub token is not configured.'});
  try{
    if(req.method==='GET'){
      const current=await publicData(),secure=await readSecurePyramids(),secureMap=secure.data||{};
      const entries=(current.data.pyramids||[]).map(entry=>({...entry,rows:(secureMap[String(entry.id)]?.rows||[]).map(row=>({clue:String(row.clue||''),answer:String(row.answer||''),length:Number(row.length||tokenize(row.answer||'').length)}))}));
      return res.status(200).json({entries});
    }
    const body=req.body||{},id=String(body.id||''),title=String(body.title||'').trim(),date=String(body.date||''),rows=normalizeRows(body.rows),error=validate(title,date,rows);
    if(error)return res.status(400).json({error});
    const current=await publicData(),secure=await readSecurePyramids(),data=current.data||{connections:[],crosswords:[],pyramids:[]};
    if(!Array.isArray(data.pyramids))data.pyramids=[];
    const secureData=secure.data||{};
    if(req.method==='POST'){
      const newId=`pyramids-${Date.now()}`; data.pyramids.push({id:newId,title,date,content:'',rows:rows.map(row=>({clue:row.clue,length:row.length}))}); secureData[newId]={rows};
      await updateJsonFile('data/entries.json',{connections:[],crosswords:[],pyramids:[]},()=>data,`Add pyramids entry: ${title}`); await writeSecurePyramids({version:1,ciphertext:encryptPyramids(secureData)},secure.sha,`Secure answers: add Pyramid ${newId}`); return res.status(201).json({ok:true,id:newId});
    }
    if(!id)return res.status(400).json({error:'Puzzle ID is required.'});
    const index=data.pyramids.findIndex(entry=>String(entry.id)===id); if(index<0)return res.status(404).json({error:'Puzzle not found.'});
    if(req.method==='DELETE'){data.pyramids.splice(index,1);delete secureData[id];await updateJsonFile('data/entries.json',{connections:[],crosswords:[],pyramids:[]},()=>data,`Delete pyramids entry: ${id}`);await writeSecurePyramids({version:1,ciphertext:encryptPyramids(secureData)},secure.sha,`Secure answers: delete Pyramid ${id}`);return res.status(200).json({ok:true});}
    if(req.method!=='PUT'){res.setHeader('Allow','GET, POST, PUT, DELETE');return res.status(405).json({error:'Method not allowed'});}
    data.pyramids[index]={...data.pyramids[index],title,date,content:'',rows:rows.map(row=>({clue:row.clue,length:row.length}))}; secureData[id]={rows};
    await updateJsonFile('data/entries.json',{connections:[],crosswords:[],pyramids:[]},()=>data,`Edit pyramids entry: ${id}`); await writeSecurePyramids({version:1,ciphertext:encryptPyramids(secureData)},secure.sha,`Secure answers: edit Pyramid ${id}`); return res.status(200).json({ok:true});
  }catch(error){console.error(error);return res.status(500).json({error:'Could not manage Pyramid.'});}
}
