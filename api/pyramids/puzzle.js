import { getSessionUser, getPuzzleAttempt, setPuzzleAttempt } from '../_lib/auth.js';
import { readJsonFile } from '../_lib/github.js';
import { readSecurePyramids } from '../_lib/pyramids.js';

function archive(entries) {
  return entries.map(entry => ({ id:String(entry.id), title:String(entry.title||entry.date), date:String(entry.date), rows:Number(entry.rowCount||1) }));
}

export default async function handler(req,res){
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  try{
    const current=await readJsonFile('data/entries.json',{connections:[],crosswords:[],pyramids:[]});
    const entries=Array.isArray(current.data.pyramids)?current.data.pyramids:[];
    const sorted=entries.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)||String(b.id).localeCompare(String(a.id)));
    const requestedId=String(req.query?.id||'');
    const puzzle=requestedId?sorted.find(entry=>String(entry.id)===requestedId):sorted[0];
    if(!puzzle)return res.status(200).json({puzzle:null,archive:[]});

    const session=getSessionUser(req);
    const resultsFile=session?await readJsonFile('data/results.json',{results:[]}):{data:{results:[]}};
    const played=session?Boolean((resultsFile.data.results||[]).some(result=>result.username===session.username&&result.type==='pyramids'&&result.puzzleId===String(puzzle.id))):false;
    const attempt=getPuzzleAttempt(req);
    const sameAttempt=attempt?.type==='pyramids'&&attempt?.puzzleId===String(puzzle.id)&&!attempt?.finished;
    if(session&&!played&&!sameAttempt)setPuzzleAttempt(res,{type:'pyramids',puzzleId:String(puzzle.id),startedAt:Date.now(),finished:false,currentRow:0,branchKey:null,revealedAnswers:[]});

    const secure=await readSecurePyramids();
    const privatePuzzle=secure.data[String(puzzle.id)];
    if(!privatePuzzle)return res.status(500).json({error:'Pyramid answer data is not configured.'});

    const activeAttempt=(sameAttempt?attempt:(session&&!played?{type:'pyramids',puzzleId:String(puzzle.id),startedAt:Date.now(),finished:false,currentRow:0,branchKey:null,revealedAnswers:[]}:null));
    const branchKey=activeAttempt?.branchKey||null;
    const branch=branchKey?privatePuzzle.branches?.[branchKey]:null;
    const revealed=Array.isArray(activeAttempt?.revealedAnswers)?activeAttempt.revealedAnswers:[];
    const currentRow=Number(activeAttempt?.currentRow||0);
    const activeRows=branch?.rows||[];

    let rowData;
    if(currentRow===0) {
      rowData={ index:0, clue:String(privatePuzzle.firstClue||''), length:1, answerChoices:undefined };
    } else {
      const row=activeRows[currentRow-1];
      rowData=row?{ index:currentRow, clue:String(row.clue||''), length:Number(row.length||currentRow+1) }:null;
    }

    const revealedRows=revealed.map((answer,index)=>({index,answer}));
    return res.status(200).json({
      puzzle:{id:String(puzzle.id),title:String(puzzle.title||puzzle.date),date:String(puzzle.date),alreadyPlayed:played,requiresLoginToSave:true,totalRows:Number(privatePuzzle.rowCount||puzzle.rowCount||1),currentRow,branchChosen:Boolean(branchKey),row:rowData,revealedRows,finished:Boolean(activeAttempt?.finished)},
      archive:archive(sorted)
    });
  }catch(error){console.error(error);return res.status(500).json({error:'Could not load Pyramid.'});}
}
