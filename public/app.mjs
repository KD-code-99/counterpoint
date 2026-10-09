import {renderResult, renderVerification} from './render.mjs';
import {setupBriefs} from './briefs.mjs';
const $ = id => document.getElementById(id);
let current, snapshot, busy = false, revision = 0, qlooConfigured = false;
async function api(action, body) {
  const response = await fetch(`/api/${action}`, body === undefined ? {} : {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  let data; try { data = await response.json(); } catch { throw new Error('The server could not return this result. Your current slate is preserved.'); }
  if (!response.ok) throw new Error(data.error || 'The request could not complete.');
  return data;
}
function setBusy(value, message = '') {
  busy = value; document.querySelector('main').setAttribute('aria-busy', String(value));
  $('status').textContent = value ? message : '';
  for (const control of document.querySelectorAll('#candidate-table input, #slots, #workshop-reset, #clear-constraints')) control.disabled = value;
  $('discover').disabled = value || !qlooConfigured;
}
function fail(err) { $('error').textContent = err.message; $('error').hidden = false; }
async function accept(data) {
  const mine = ++revision; current = data; renderResult(data); $('error').hidden = true;
  // Rendering replaces the inventory inputs; keep the new controls locked until replay finishes.
  if (busy) setBusy(true, $('status').textContent);
  if (!data.receipt) { $('verification').textContent = 'A feasible slate is needed before a receipt can be checked.'; return; }
  $('verification').textContent = 'Replaying both objectives with the independent checker…';
  try { const checked = await api('verify', {receipt: data.receipt}); if (revision === mine) renderVerification(checked); }
  catch (err) { if (revision === mine) $('verification').textContent = err.message; }
}
async function reset() {
  if (busy) return;
  setBusy(true, 'Loading the illustrative workshop…');
  try { const data = await api('workshop'); snapshot = null; await accept(data); }
  catch (err) { fail(err); }
  finally { setBusy(false); }
}
async function replan(changes, focus) {
  if (!current || busy) return;
  setBusy(true, 'Replanning both priorities under your updated constraints…');
  try {
    const p = current.problem;
    await accept(await api('curate', {mode:snapshot ? 'live' : 'workshop', snapshot, slots:p.slots, pinned:p.pinned, excluded:p.excluded, ...changes}));
  } catch (err) { fail(err); renderResult(current); }
  finally { setBusy(false); if (focus) document.querySelector(focus)?.focus({preventScroll:true}); }
}
$('slots').addEventListener('change', () => replan({slots:Number($('slots').value)}, '#slots'));
$('candidate-table').addEventListener('change', e => {
  if (!current) return;
  const pin = e.target.dataset.pin, stock = e.target.dataset.stock;
  if (pin) {
    const ids = new Set(current.problem.pinned); e.target.checked ? ids.add(pin) : ids.delete(pin);
    replan({pinned:[...ids]}, `[data-pin="${CSS.escape(pin)}"]`);
  } else if (stock) {
    const ids = new Set(current.problem.excluded); e.target.checked ? ids.delete(stock) : ids.add(stock);
    replan({excluded:[...ids]}, `[data-stock="${CSS.escape(stock)}"]`);
  }
});
$('clear-constraints').addEventListener('click', () => replan({pinned:[],excluded:[]}, '#clear-constraints'));
$('workshop-reset').addEventListener('click', reset);
$('download').addEventListener('click', () => {
  if (!current?.receipt) return;
  const blob = new Blob([JSON.stringify(current.receipt,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url;
  a.download = `counterpoint-${current.receipt.provenance.live_qloo?'qloo':'workshop'}-${current.receipt.sha256.slice(0,10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('print').addEventListener('click', () => window.print());
$('receipt-file').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 250000) { $('verification').textContent = 'The receipt exceeds 250 KB. Select a Counterpoint JSON receipt.'; e.target.value=''; return; }
  const mine = ++revision; $('verification').textContent = 'Checking the saved receipt…';
  try {
    const receipt = JSON.parse(await file.text()); const checked = await api('verify', {receipt});
    if (revision === mine) renderVerification(checked, 'Saved receipt');
  } catch (err) { $('verification').textContent = `Could not check the file: ${err.message}`; }
  finally { e.target.value=''; }
});
for (const name of ['briefs','about','agent']) $(`${name}-open`).addEventListener('click', () => $(`${name}-dialog`).showModal());
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.close).close()));
$('mcp-url').textContent = `${location.origin}/api/mcp`;
setupBriefs({api, onDiscover:async data => { snapshot=data.snapshot; await accept(data); }, setBusy});
async function connection() {
  try {
    const health = await api('health'); qlooConfigured = health.qloo_configured;
    $('connection').textContent = qlooConfigured ? 'Qloo discovery available · public cultural references only' : 'Live Qloo access pending · explore the workshop below';
    $('builder-availability').textContent = qlooConfigured ? 'Qloo will discover and rank books. Each search sends only the public reference you enter.' : 'Live discovery is awaiting event API access. You can explore the complete workshop without a credential.';
    $('discover').disabled = busy || !qlooConfigured;
  } catch { $('connection').textContent = 'Could not check live access. The workshop remains available.'; }
}
await Promise.all([connection(), reset()]);
