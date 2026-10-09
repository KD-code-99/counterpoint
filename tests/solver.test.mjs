import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {solve} from '../lib/solver.mjs';
import {curate} from '../lib/receipt.mjs';
import {auditSelection,verifyReceipt} from '../lib/checker.mjs';
import {canonical} from '../lib/problem.mjs';
import {workshop,workshopProvenance} from '../fixtures/workshop.mjs';

test('least-covered-first exposes the cost of protecting a niche brief',()=>{
  const balanced=solve(workshop), total=solve(workshop,'total');
  assert.ok(balanced.floor>total.floor);
  assert.ok(balanced.total<total.total);
  assert.equal(balanced.evaluated,28);
  assert.equal(auditSelection(workshop,balanced).valid,true);
});
test('removing a selected book produces a different feasible decision',()=>{
  const first=solve(workshop);const p={...workshop,excluded:[first.selected[0]]};
  const second=solve(p);assert.equal(second.selected.includes(first.selected[0]),false);
  assert.equal(auditSelection(p,second).valid,true);
});
test('pins are respected even when they reduce the objective',()=>{
  const p={...workshop,pinned:['book-07','book-08']};
  const s=solve(p);assert.deepEqual(s.selected,p.pinned);assert.equal(s.evaluated,1);
  assert.equal(auditSelection(p,s).valid,true);
});
test('infeasible constraints are explicit',()=>{
  assert.equal(solve({...workshop,pinned:['book-01'],excluded:['book-01']}).status,'infeasible');
  assert.equal(solve({...workshop,pinned:['book-01','book-02','book-03']}).status,'infeasible');
  assert.equal(solve({...workshop,excluded:workshop.candidates.map(c=>c.id)}).status,'infeasible');
});
test('bad evidence shapes, duplicates and unsafe numbers are rejected',()=>{
  for (const mutate of [p=>p.slots=0,p=>p.candidates[0].scores[0]=NaN,p=>p.candidates[0].scores.pop(),p=>p.candidates.push(p.candidates[0]),p=>p.pinned=['invented']]) {
    const p=structuredClone(workshop);mutate(p);assert.throws(()=>solve(p));
  }
});
test('the independent verifier provides a counterexample to a suboptimal balanced claim',()=>{
  const falseClaim={...solve(workshop,'total'),objective:'balanced'};
  const audit=auditSelection(workshop,falseClaim);
  assert.equal(audit.valid,false);assert.ok(audit.counterexample);
});
test('a receipt replays, detects an edit, and detects a rehashed false optimality claim',()=>{
  const {receipt}=curate(workshop,workshopProvenance);
  assert.equal(verifyReceipt(receipt).valid,true);
  const edit=structuredClone(receipt);edit.problem.candidates[0].scores[0]--;
  assert.match(verifyReceipt(edit).reason,/changed/);
  const lie=structuredClone(receipt);lie.balanced={...lie.baseline,objective:'balanced'};
  const {sha256,...body}=lie;lie.sha256=createHash('sha256').update(canonical(body)).digest('hex');
  assert.equal(verifyReceipt(lie).valid,false);
});
test('zero evidence and ties do not fabricate coverage',()=>{
  const p={...workshop,candidates:workshop.candidates.map(c=>({...c,scores:[0,0,0]}))};
  const s=solve(p);assert.equal(s.floor,0);assert.equal(s.total,0);assert.deepEqual(s.selected,['book-01','book-02']);
  assert.equal(auditSelection(p,s).valid,true);
});

// Third lane: a bit-mask oracle, unlike either production enumerator. Small cases only.
function maskOracle(p,mode) {
  let best=null;
  for(let mask=0;mask<2**p.candidates.length;mask++) {
    const rows=p.candidates.filter((_,i)=>mask&(1<<i));
    if(rows.length!==p.slots||rows.some(c=>p.excluded.includes(c.id))||p.pinned.some(id=>!rows.some(c=>c.id===id))) continue;
    const scores=p.boards.map((_,j)=>Math.max(...rows.map(c=>c.scores[j])));
    const vector=scores.toSorted((a,b)=>a-b);if(mode==='total')vector.unshift(scores.reduce((a,b)=>a+b,0));
    if(!best||vector.some((x,j)=>x>best[j]&&vector.slice(0,j).every((y,k)=>y===best[k])))best=vector;
  } return best;
}
test('250 randomized problems agree with a third independent oracle in both objectives',()=>{
  let state=20261009;const rand=n=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state%n;};
  for(let trial=0;trial<250;trial++) {
    const n=3+rand(6),m=2+rand(3),slots=1+rand(Math.min(n,4));
    const p={boards:Array.from({length:m},(_,i)=>({id:`b${i}`,name:`Brief ${i}`})),candidates:Array.from({length:n},(_,i)=>({id:`c${i}`,title:`Test ${i}`,scores:Array.from({length:m},()=>rand(1001))})),slots,pinned:rand(3)===0?['c0']:[],excluded:rand(3)===0?[`c${n-1}`]:[]};
    for(const mode of ['balanced','total']) {
      const expected=maskOracle(p,mode),actual=solve(p,mode);
      if(!expected){assert.equal(actual.status,'infeasible');continue;}
      const got=actual.coverage.toSorted((a,b)=>a-b);if(mode==='total')got.unshift(actual.total);
      assert.deepEqual(got,expected,`trial ${trial}, mode ${mode}`);
      assert.equal(auditSelection(p,actual).valid,true);
    }
  }
});
