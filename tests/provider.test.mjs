import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonical} from '../lib/problem.mjs';
import {makeQloo, discover, validateBriefs} from '../lib/qloo.mjs';
import {makeSnapshots} from '../lib/snapshot.mjs';
import {makeApplication} from '../lib/application.mjs';
import {verifyReceipt} from '../lib/checker.mjs';

// Controlled transport fixtures only. These tests do not call Qloo or measure its output.
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const entity = (n, type='book') => ({entity_id:uuid(n), name:`Transport fixture ${n}`, type:`urn:entity:${type}`});
const json = body => new Response(JSON.stringify(body), {headers:{'Content-Type':'application/json'}});
const seed = n => ({id:uuid(n), name:`Public fixture ${n}`, type:'urn:entity:movie'});
const briefs = [{name:'A',seeds:[seed(1)]},{name:'B',seeds:[seed(2)]}];

test('no credential fails explicitly without issuing a network request', async () => {
  const q = makeQloo({key:'', fetcher:()=>{throw Error('must not run');}});
  await assert.rejects(q.search('movie','movie'), e=>e.code==='QLOO_ACCESS_PENDING');
});
test('auth, quota, transport and malformed evidence never fall back', async () => {
  for (const [status, code] of [[401,'QLOO_AUTH'],[403,'QLOO_AUTH'],[429,'QLOO_QUOTA'],[500,'QLOO_UPSTREAM']]) {
    const q=makeQloo({key:'unit-test',fetcher:async()=>new Response('private provider detail',{status})});
    await assert.rejects(q.search('public','movie'), e=>e.code===code && !e.message.includes('private'));
  }
  for (const body of [{results:'wrong'}, {results:[{name:'No ID'}]}, {results:[entity(1)],success:false}]) {
    const q=makeQloo({key:'unit-test',fetcher:async()=>json(body)});
    await assert.rejects(q.search('public','movie'));
  }
  const q=makeQloo({key:'unit-test',fetcher:async()=>{throw Error('contains credential');}});
  await assert.rejects(q.search('public','movie'), e=>e.code==='QLOO_UNREACHABLE' && !e.message.includes('credential'));
});
test('request contract fixes host, header, category, endpoint and bounded search; cache reuses evidence', async () => {
  let calls=0;
  const q=makeQloo({key:'unit-test',fetcher:async(url, options)=>{
    calls++; assert.equal(url.origin,'https://api.qloo.com'); assert.equal(url.pathname,'/search');
    assert.equal(url.searchParams.get('types'),'urn:entity:movie'); assert.equal(url.searchParams.get('take'),'5');
    assert.equal(options.headers['X-Api-Key'],'unit-test'); assert.equal(options.redirect,'error');
    return json({results:[entity(1,'movie')]});
  }});
  const first=await q.search('Some movie','movie'), second=await q.search('Some movie','movie');
  assert.equal(calls,1); assert.equal(first.cached,false); assert.equal(second.cached,true);
  assert.match(first.trace.response_sha256,/^[0-9a-f]{64}$/);
  assert.throws(()=>makeQloo({base:'https://example.com'}));
  await assert.rejects(q.search('Jane','person'));
});
test('response-dependent second pass reranks the same finite universe for each brief', async () => {
  const requests=[];
  const q=makeQloo({key:'unit-test',fetcher:async(url)=>{
    requests.push(url);
    const isA=url.searchParams.get('signal.interests.entities')===uuid(1);
    const ranking=url.searchParams.get('filter.results.entities');
    return json({results:{entities:ranking ? (isA?[entity(11),entity(12),entity(13)]:[entity(13),entity(12)]) : (isA?[entity(11),entity(12)]:[entity(13),entity(12)])}});
  }});
  const out=await discover(q,briefs);
  assert.equal(requests.length,4); assert.equal(out.candidates.length,3);
  for (const url of requests.slice(2)) assert.equal(url.searchParams.get('filter.results.entities'),[uuid(11),uuid(13),uuid(12)].join(','));
  assert.deepEqual(out.candidates.find(c=>c.id===uuid(11)).scores,[1000,0]);
  assert.deepEqual(out.candidates.find(c=>c.id===uuid(12)).scores,[500,500]);
  assert.equal(out.provenance.requests,4);
});
test('empty discovery and invalid cultural briefs report a useful error', async () => {
  const q=makeQloo({key:'unit-test',fetcher:async()=>json({results:[]})});
  await assert.rejects(discover(q,briefs),e=>e.code==='QLOO_EMPTY');
  assert.throws(()=>validateBriefs([{name:'a',seeds:[seed(1)]}]));
  assert.throws(()=>validateBriefs([{name:'a',seeds:[seed(1)]},{name:'a',seeds:[seed(2)]}]));
  assert.throws(()=>validateBriefs([{name:'a',seeds:[{...seed(1),type:'urn:entity:person'}]},briefs[1]]));
});
test('signed evidence cannot be edited, expired, or moved between credentials', t => {
  const signer=makeSnapshots('unit-test'), token=signer.issue({kind:'test',value:10});
  assert.equal(signer.read(token).value,10);
  assert.throws(()=>signer.read({...token,value:11}));
  assert.throws(()=>makeSnapshots('different-test').read(token));
  assert.throws(()=>signer.read({...token,signature:'not-hex'}));
  t.mock.method(Date, 'now', () => token.expires_at + 1);
  assert.throws(()=>signer.read(token), /expired/);
});
test('application verifies chosen seed proofs and binds replanning to server evidence', async () => {
  const signer=makeSnapshots('unit-test');
  const q=makeQloo({key:'unit-test',fetcher:async(url)=>json({results:{entities:url.pathname==='/search'?[entity(1,'movie')]:[entity(11),entity(12),entity(13)]}})});
  const run=makeApplication({qloo:q,snapshots:signer});
  const search=await run('search',{query:'public','type':'movie'});
  const chosen=search.entities[0];
  const result=await run('discover',{briefs:[{name:'A',seeds:[chosen]},{name:'B',seeds:[chosen]}],slots:2});
  assert.equal(verifyReceipt(result.receipt).valid,true);
  const {sha256, ...tampered} = structuredClone(result.receipt);
  tampered.problem.candidates[0].scores[0]--;
  const rehashed = {...tampered, sha256:createHash('sha256').update(canonical(tampered)).digest('hex')};
  assert.match(verifyReceipt(rehashed).reason, /recorded Qloo rank/);
  const next=await run('curate',{snapshot:result.snapshot,slots:2,excluded:[result.balanced.selected[0]]});
  assert.equal(next.balanced.status,'optimal'); assert.equal(verifyReceipt(next.receipt).valid,true);
  await assert.rejects(run('discover',{briefs:[{name:'A',seeds:[{...chosen,proof:{...chosen.proof,entity:seed(99)}}]}, {name:'B',seeds:[chosen]}]}));
  await assert.rejects(run('curate',{snapshot:{...result.snapshot,candidates:[]},slots:2}));
  await assert.rejects(run('curate',{snapshot:chosen.proof,slots:2}));
  assert.equal((await run('curate',{mode:'workshop',slots:2})).receipt.provenance.live_qloo,false);
});

test('four disjoint discoveries retain six candidates from each brief within the 24-book cap', async () => {
  const requests=[];
  const q=makeQloo({key:'unit-test',fetcher:async url=>{
    requests.push(url);
    const filter=url.searchParams.get('filter.results.entities');
    const rows=filter ? filter.split(',').map(id=>({entity_id:id,name:'Reranked fixture',type:'urn:entity:book'})) :
      Array.from({length:12},(_,i)=>entity(Number(url.searchParams.get('signal.interests.entities').slice(-4))*100+i));
    return json({results:{entities:rows}});
  }});
  const input=Array.from({length:4},(_,i)=>({name:`Brief ${i+1}`,seeds:[seed(i+1)]}));
  const out=await discover(q,input);
  assert.equal(out.candidates.length,24); assert.equal(requests.length,8);
  for(let i=1;i<=4;i++) assert.equal(out.candidates.filter(c=>Math.floor(Number(c.id.slice(-4))/100)===i).length,6);
});
