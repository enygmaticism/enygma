import auth from '../lib/routes/auth.js';import adminCheck from '../lib/routes/admin-check.js';import adminEntries from '../lib/routes/admin-entries.js';import adminPuzzles from '../lib/routes/admin-puzzles.js';import adminPyramids from '../lib/routes/admin-pyramids.js';import connections from '../lib/routes/connections.js';import pyramidPuzzle from '../lib/routes/pyramid.js';import pyramidSubmit from '../lib/routes/pyramid-submit.js';import stats from '../lib/routes/stats.js';
export default async function handler(req,res){
 const raw=String(req.query?.path||'').replace(/^\/+|\/+$/g,'');
 const parts=raw.split('/');
 if(parts[0]==='auth') return auth(req,res);
 if(parts[0]==='admin'){if(parts[1]==='check'||parts.length===1)return adminCheck(req,res);if(parts[1]==='entries')return adminEntries(req,res);if(parts[1]==='puzzles')return adminPuzzles(req,res);if(parts[1]==='pyramids')return adminPyramids(req,res);}
 if(parts[0]==='connections') return connections(req,res);
 if(parts[0]==='pyramids') return parts[1]==='submit'?pyramidSubmit(req,res):pyramidPuzzle(req,res);
 if(parts[0]==='stats'||parts[0]==='results'||parts[0]==='rankings') return stats(req,res);
 return res.status(404).json({error:'API route not found.'});
}
