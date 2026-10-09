import {validateProblem} from './problem.mjs';

export function coverageFor(problem, selected) {
  const chosen = new Set(selected);
  return problem.boards.map((_, i) => Math.max(0, ...problem.candidates.filter(c => chosen.has(c.id)).map(c => c.scores[i])));
}

function compare(a, b, objective) {
  if (!b) return 1;
  const aa = objective === 'total' ? [a.reduce((x,y)=>x+y,0), ...a.toSorted((x,y)=>x-y)] : a.toSorted((x,y)=>x-y);
  const bb = objective === 'total' ? [b.reduce((x,y)=>x+y,0), ...b.toSorted((x,y)=>x-y)] : b.toSorted((x,y)=>x-y);
  for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return aa[i] - bb[i];
  return 0;
}

export function solve(raw, objective = 'balanced') {
  const problem = validateProblem(raw);
  if (!['balanced','total'].includes(objective)) throw new Error('Unknown objective.');
  const available = problem.candidates.filter(c => !problem.excluded.includes(c.id));
  const conflicts = problem.pinned.filter(id => problem.excluded.includes(id));
  if (conflicts.length) return {status: 'infeasible', reason: 'A pinned book is also unavailable.', conflicts, evaluated: 0};
  if (problem.pinned.length > problem.slots) return {status: 'infeasible', reason: 'There are more pinned books than slate places.', evaluated: 0};
  if (available.length < problem.slots) return {status: 'infeasible', reason: 'There are fewer available books than slate places.', evaluated: 0};
  const fixed = available.filter(c => problem.pinned.includes(c.id));
  const pool = available.filter(c => !problem.pinned.includes(c.id));
  const remaining = problem.slots - fixed.length;
  let evaluated = 0, winner = null, bestCoverage = null;
  const visit = (offset, chosen) => {
    if (chosen.length === remaining) {
      const slate = [...fixed, ...chosen];
      const coverage = problem.boards.map((_, i) => Math.max(...slate.map(c => c.scores[i])));
      evaluated++;
      const ids = slate.map(c => c.id).sort();
      const order = compare(coverage, bestCoverage, objective);
      if (order > 0 || (order === 0 && JSON.stringify(ids) < JSON.stringify(winner))) {winner = ids; bestCoverage = coverage;}
      return;
    }
    for (let i = offset; i <= pool.length - (remaining - chosen.length); i++) visit(i+1, [...chosen, pool[i]]);
  };
  visit(0, []);
  return {status: 'optimal', objective, selected: winner, coverage: bestCoverage,
    floor: Math.min(...bestCoverage), total: bestCoverage.reduce((a,b)=>a+b,0), evaluated,
    guarantee: 'Optimal only over this supplied finite candidate set, these supplied scores and these constraints.'};
}
