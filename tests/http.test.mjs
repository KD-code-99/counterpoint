import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {makeHandler} from '../lib/http.mjs';
import {makeApplication} from '../lib/application.mjs';
import {makeQloo} from '../lib/qloo.mjs';
import {makeSnapshots} from '../lib/snapshot.mjs';
const server=createServer(makeHandler(makeApplication({qloo:makeQloo({key:''}),snapshots:makeSnapshots('')})));
let base;
test.before(async()=>{server.listen(0,'127.0.0.1'); await once(server,'listening'); base=`http://127.0.0.1:${server.address().port}`;});
test.after(()=>new Promise(resolve=>{server.closeAllConnections(); server.close(resolve);}));
const post=(path,body,extra={})=>fetch(`${base}/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(body)});

test('HTTP workshop, infeasible replan and independent receipt verification',async()=>{
  const response=await fetch(`${base}/api/workshop`); assert.equal(response.status,200);
  assert.match(response.headers.get('content-security-policy'),/script-src 'self'/);
  const data=await response.json(); assert.equal(data.receipt.provenance.live_qloo,false);
  const check=await (await post('verify',{receipt:data.receipt})).json(); assert.equal(check.valid,true);
  const unavailable=await (await post('curate',{mode:'workshop',slots:2,pinned:['book-01'],excluded:['book-01']})).json();
  assert.equal(unavailable.balanced.status,'infeasible'); assert.equal(unavailable.receipt,null);
  const edited=structuredClone(data.receipt); edited.balanced.floor++;
  assert.equal((await (await post('verify',{receipt:edited})).json()).valid,false);
});
test('HTTP rejects malformed, oversized, cross-origin and unauthenticated live requests',async()=>{
  assert.equal((await post('curate',null)).status,400);
  assert.equal((await post('search',{query:'film',type:'movie'})).status,503);
  assert.equal((await post('verify',{receipt:{}},{Origin:'https://foreign.example'})).status,403);
  assert.equal((await post('verify',{padding:'x'.repeat(270000)})).status,400);
  assert.equal((await fetch(`${base}/api/curate`)).status,405);
  assert.equal((await fetch(`${base}/api/curate`,{method:'POST',body:'{}'})).status,415);
});
test('stateless MCP initializes, lists tools, curates workshop and returns tool errors explicitly',async()=>{
  const rpc=async(id,method,params)=>{const r=await post('mcp',{jsonrpc:'2.0',id,method,params});return r.status===202?null:r.json();};
  assert.equal((await rpc(1,'initialize',{})).result.protocolVersion,'2025-03-26');
  assert.equal((await rpc(2,'tools/list')).result.tools.length,4);
  const curated=await rpc(3,'tools/call',{name:'counterpoint_curate',arguments:{mode:'workshop',slots:2}});
  assert.equal(JSON.parse(curated.result.content[0].text).balanced.status,'optimal');
  const failed=await rpc(4,'tools/call',{name:'counterpoint_search',arguments:{query:'film',type:'movie'}});
  assert.equal(failed.result.isError,true);
  assert.equal((await rpc(5,'tools/call',{name:'unknown'})).error.code,-32602);
  assert.equal(await rpc(undefined,'notifications/initialized'),null);
});
test('Vercel rewritten action dispatches to the same implementation',async()=>{
  const response=await fetch(`${base}/api/index.mjs?action=health`); assert.equal(response.status,200);
  assert.equal((await response.json()).qloo_configured,false);
});
