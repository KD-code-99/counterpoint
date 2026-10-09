import {createHash} from 'node:crypto';
import {canonical,validateProblem} from './problem.mjs';
import {solve} from './solver.mjs';

export function curate(raw, provenance={mode:'operator-supplied'}) {
  const problem=validateProblem(raw);
  const balanced=solve(problem,'balanced');
  if (balanced.status!=='optimal') return {problem,balanced,baseline:null,receipt:null};
  const baseline=solve(problem,'total');
  const body={schema:'counterpoint.receipt.v1',created_at:new Date().toISOString(),problem,balanced,baseline,provenance};
  const sha256=createHash('sha256').update(canonical(body)).digest('hex');
  return {problem,balanced,baseline,receipt:{...body,sha256}};
}
