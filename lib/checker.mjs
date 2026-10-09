// Independent arithmetic and iterative combination enumeration. Does not import the solver.
import {createHash} from 'node:crypto';
import {canonical, validateProblem} from './problem.mjs';

const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
function measure(problem, ids) {
  const out = Array(problem.boards.length).fill(0);
  for (const id of ids) {
    const row = problem.candidates.find(c => c.id === id);
    for (let j = 0; j < out.length; j++) if (row.scores[j] > out[j]) out[j] = row.scores[j];
  }
  return out;
}
function higher(a, b, mode) {
  const sum = xs => xs.reduce((x,y)=>x+y,0);
  if (mode === 'total' && sum(a) !== sum(b)) return sum(a) > sum(b);
  const x=[...a].sort((a,b)=>a-b), y=[...b].sort((a,b)=>a-b);
  for (let j=0;j<x.length;j++) if (x[j] !== y[j]) return x[j]>y[j];
  return false;
}

export function auditSelection(raw, claim) {
  let p;
  try { p=validateProblem(raw); } catch(e) { return {valid:false, reason:e.message}; }
  if (!claim || claim.status !== 'optimal' || !['balanced','total'].includes(claim.objective)) return {valid:false,reason:'An optimal selection with a supported objective is required.'};
  const ids=claim.selected;
  if (!Array.isArray(ids) || ids.length!==p.slots || new Set(ids).size!==ids.length || ids.some(id=>!p.candidates.some(c=>c.id===id)||p.excluded.includes(id)) || p.pinned.some(id=>!ids.includes(id))) return {valid:false,reason:'The claimed selection violates a slate constraint.'};
  const coverage=measure(p,ids);
  if (canonical(coverage)!==canonical(claim.coverage) || claim.floor!==Math.min(...coverage) || claim.total!==coverage.reduce((a,b)=>a+b,0)) return {valid:false,reason:'The claimed scores do not match the evidence matrix.'};
  const available=p.candidates.filter(c=>!p.excluded.includes(c.id));
  const indices=Array.from({length:p.slots},(_,i)=>i);
  let evaluated=0;
  while (true) {
    const alternative=indices.map(i=>available[i].id);
    if (p.pinned.every(id=>alternative.includes(id))) {
      evaluated++;
      const alt=measure(p,alternative);
      if (higher(alt,coverage,claim.objective)) return {valid:false,reason:'A better feasible slate exists.',counterexample:{selected:alternative,coverage:alt},evaluated};
    }
    let position=p.slots-1;
    while (position>=0 && indices[position]===available.length-p.slots+position) position--;
    if (position<0) break;
    indices[position]++;
    for (let j=position+1;j<p.slots;j++) indices[j]=indices[j-1]+1;
  }
  return {valid:true,evaluated,coverage,scope:'Finite-universe feasibility and objective optimality; not validation of Qloo data authenticity or real-world customer satisfaction.'};
}

export function verifyReceipt(receipt) {
  if (!receipt || receipt.schema!=='counterpoint.receipt.v1') return {valid:false,reason:'Unsupported receipt schema.'};
  const {sha256,...body}=receipt;
  if (typeof sha256!=='string' || digest(body)!==sha256) return {valid:false,reason:'Receipt contents changed: SHA-256 does not match.'};
  if (body.provenance?.live_qloo === true) {
    let p;
    try { p = validateProblem(body.problem); } catch (err) { return {valid:false,reason:err.message}; }
    const rankings = body.provenance.rankings;
    if (!Array.isArray(rankings) || rankings.length !== p.boards.length) return {valid:false,reason:'Live evidence requires one recorded ranking per brief.'};
    for (let i = 0; i < p.boards.length; i++) {
      const rank = rankings[i];
      if (rank?.brief_id !== p.boards[i].id || !Array.isArray(rank.ordered_ids) || new Set(rank.ordered_ids).size !== rank.ordered_ids.length || rank.ordered_ids.some(id=>!p.candidates.some(c=>c.id===id))) return {valid:false,reason:'The recorded ranking does not match the candidate universe.'};
      for (const c of p.candidates) {
        const index = rank.ordered_ids.indexOf(c.id);
        if (c.scores[i] !== (index < 0 ? 0 : Math.round(1000 / (index + 1)))) return {valid:false,reason:'A candidate score does not match its recorded Qloo rank.'};
      }
    }
  }
  const balanced=auditSelection(body.problem,body.balanced);
  if (!balanced.valid) return {...balanced,lane:'balanced'};
  const baseline=auditSelection(body.problem,body.baseline);
  if (!baseline.valid) return {...baseline,lane:'baseline'};
  if (body.balanced.objective!=='balanced'||body.baseline.objective!=='total') return {valid:false,reason:'Objectives were mislabeled.'};
  return {valid:true,sha256,balanced,baseline,provenance:'A matching hash binds the supplied evidence and result; it is not a provider signature.'};
}
