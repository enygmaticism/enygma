import { getSessionUser, getPuzzleAttempt, setPuzzleAttempt } from '../_lib/auth.js';
import { readJsonFile, updateJsonFile } from '../_lib/github.js';
import { readSecurePyramids, tokenize } from '../_lib/pyramids.js';

function normalize(value){ return tokenize(value).join('|'); }

export default async function handler(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
  const session=getSessionUser(req);
  if(!session)return res.status(401).json({error:'Log in to play Pyramids and save your result.'});
  try{
    const puzzleId=String(req.body?.puzzleId||''), answer=normalize(req.body?.answer||'');
    if(!puzzleId||!answer)return res.status(400).json({error:'Puzzle and answer are required.'});

    const entries=await readJsonFile('data/entries.json',{pyramids:[]});
    const puzzle=(entries.data.pyramids||[]).find(entry=>String(entry.id)===puzzleId);
    if(!puzzle)return res.status(404).json({error:'Puzzle not found.'});

    const resultsFile=await readJsonFile('data/results.json',{results:[]});
    const results=Array.isArray(resultsFile.data.results)?resultsFile.data.results:[];
    if(results.some(result=>result.username===session.username&&result.type==='pyramids'&&result.puzzleId===puzzleId))return res.status(409).json({error:'This is not your first time playing this puzzle, so it will not influence the ranking.',alreadyPlayed:true});

    const secure=await readSecurePyramids(),privatePuzzle=secure.data[puzzleId];
    if(!privatePuzzle)return res.status(500).json({error:'Pyramid answer data is not configured.'});

    let attempt=getPuzzleAttempt(req);
    if(!attempt||attempt.type!=='pyramids'||attempt.puzzleId!==puzzleId||attempt.finished){
      attempt={type:'pyramids',puzzleId,startedAt:Date.now(),finished:false,currentRow:0,branchKey:null,revealedAnswers:[]};
    }

    const currentRow=Number(attempt.currentRow||0);
    let expected;
    let branchKey=attempt.branchKey||null;

    if(currentRow===0){
      const firstAnswers=Array.isArray(privatePuzzle.firstAnswers)?privatePuzzle.firstAnswers.map(normalize):[];
      const matchIndex=firstAnswers.indexOf(answer);
      if(matchIndex===-1){setPuzzleAttempt(res,attempt);return res.status(200).json({ok:true,correct:false,incorrect:true,message:'incorrect',currentRow:0});}
      branchKey=privatePuzzle.firstAnswers[matchIndex];
      attempt.branchKey=branchKey;
      attempt.revealedAnswers=[tokenize(req.body.answer).join(' ' )];
      attempt.currentRow=1;
    } else {
      const branch=privatePuzzle.branches?.[branchKey];
      if(!branch)return res.status(500).json({error:'Selected Pyramid branch is missing.'});
      const row=branch.rows?.[currentRow-1];
      if(!row)return res.status(500).json({error:'Pyramid row data is missing.'});
      expected=normalize(row.answer);
      if(expected!==answer){setPuzzleAttempt(res,attempt);return res.status(200).json({ok:true,correct:false,incorrect:true,message:'incorrect',currentRow});}
      attempt.revealedAnswers=[...(attempt.revealedAnswers||[]),tokenize(req.body.answer).join(' ')];
      attempt.currentRow=currentRow+1;
    }

    const totalRows=Number(privatePuzzle.rowCount||1);
    const completed=attempt.currentRow>=totalRows;
    if(!completed){
      setPuzzleAttempt(res,attempt);
      const branch=privatePuzzle.branches?.[branchKey];
      const next=branch?.rows?.[attempt.currentRow-1];
      return res.status(200).json({ok:true,correct:true,completed:false,currentRow:attempt.currentRow,clue:String(next?.clue||''),length:Number(next?.length||attempt.currentRow+1),revealedAnswers:attempt.revealedAnswers});
    }

    const solveTimeSeconds=Math.max(0,Math.min(86400,Math.round((Date.now()-Number(attempt.startedAt||Date.now()))/1000)));
    const score=totalRows*100+totalRows*50;
    await updateJsonFile('data/results.json',{results:[]},data=>{
      if(!Array.isArray(data.results))data.results=[];
      if(!data.results.some(result=>result.username===session.username&&result.type==='pyramids'&&result.puzzleId===puzzleId))data.results.push({id:`${session.username}-${puzzleId}`,username:session.username,type:'pyramids',puzzleId,puzzleDate:String(puzzle.date),solveTimeSeconds,groupsSolved:totalRows,completed:true,score,createdAt:new Date().toISOString()});
      return data;
    },`Record Pyramid result: ${session.username} / ${puzzleId}`);

    attempt.finished=true;
    setPuzzleAttempt(res,attempt);
    return res.status(200).json({ok:true,correct:true,completed:true,currentRow:totalRows,totalRows,score,solveTimeSeconds,revealedAnswers:attempt.revealedAnswers});
  }catch(error){console.error(error);return res.status(500).json({error:'Could not save Pyramid result.'});}
}
