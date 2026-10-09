export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const byId = id => document.getElementById(id);
const names = (problem, selection) => selection.map(id => problem.candidates.find(c => c.id === id));

export function renderResult(data) {
  const {problem: p, balanced: b, baseline: t} = data;
  byId('slots').value = p.slots;
  byId('brief-labels').innerHTML = p.boards.map((board, i) => `<div class="brief-tag"><span>${i+1}</span>${esc(board.name)}</div>`).join('');
  const ready = b.status === 'optimal';
  byId('download').disabled = !ready; byId('print').disabled = !ready;
  if (!ready) {
    byId('result').innerHTML = `<div class="infeasible"><h3>This table needs an adjustment.</h3><p>${esc(b.reason)} Unpin a book, restore stock or change the number of places.</p></div>`;
    byId('comparison-content').innerHTML = '<p class="section-description">Resolve the conflicting constraints to compare two feasible slates.</p>';
  } else {
    const picked = names(p, b.selected);
    byId('result').innerHTML = `<div class="slate-layout"><div class="book-row">${picked.map((c, i) => `<article class="book"><div class="book-index">THE READING TABLE / ${String(i+1).padStart(2,'0')}</div>${p.pinned.includes(c.id)?'<span class="book-pin">PINNED</span>':''}<h3>${esc(c.title)}</h3><small>${esc(c.author || 'Qloo book candidate')}<br>Strongest evidence: ${esc(p.boards[c.scores.indexOf(Math.max(...c.scores))].name)}</small></article>`).join('')}</div><aside class="decision-note" aria-label="Selection explanation"><p class="eyebrow">LEAST-COVERED BRIEF</p><div class="floor">${b.floor}<span>/ 1000</span></div><p>Every brief reaches at least this evidence score. The quieter brief gets a place in the decision.</p><p class="check">${b.evaluated.toLocaleString()} feasible slates compared</p><p class="small">Exact for these ${p.candidates.length} candidates, this scoring rule and your constraints.</p></aside></div>`;
    const delta = b.floor - t.floor, cost = t.total - b.total;
    const story = delta === 0 ? 'Both priorities reach the same coverage floor in this case. There is no measured floor advantage to claim.' : `The balanced slate raises the coverage floor by ${delta} points. Its total coverage is ${cost} points lower. That is the explicit editorial tradeoff.`;
    byId('comparison-content').innerHTML = `<div class="comparison-grid"><div><div class="legend"><span>Least-covered first</span><span>Total first</span></div>${p.boards.map((board, i) => `<div class="coverage-row"><h3>${esc(board.name)}</h3><div class="bar-row"><div class="bar-track"><meter min="0" max="1000" value="${b.coverage[i]}" aria-label="${esc(board.name)} balanced coverage">${b.coverage[i]}</meter></div><span class="bar-value">${b.coverage[i]}</span></div><div class="bar-row"><div class="bar-track total"><meter min="0" max="1000" value="${t.coverage[i]}" aria-label="${esc(board.name)} total-first coverage">${t.coverage[i]}</meter></div><span class="bar-value">${t.coverage[i]}</span></div></div>`).join('')}</div><aside class="comparison-summary"><h3>IF YOU MAXIMIZED THE TOTAL</h3><ul class="mini-books">${names(p,t.selected).map(c=>`<li>${esc(c.title)}</li>`).join('')}</ul><p class="tradeoff">${esc(story)}</p><p class="small">Total coverage: ${b.total} balanced / ${t.total} total-first.</p></aside></div>`;
  }
  renderTable(p, ready ? b.selected : []);
  const live = data.receipt?.provenance.live_qloo;
  const notice = byId('mode-notice');
  notice.classList.toggle('live', Boolean(live));
  if (data.receipt) {
    notice.querySelector('strong').textContent = live ? 'Live Qloo evidence · finite candidate comparison' : 'Workshop · invented books and scores';
    notice.querySelector('p').textContent = live ? `${data.receipt.provenance.requests} bounded API requests (${data.receipt.provenance.network_requests} uncached). Book availability stays under your control.` : 'Explore the decision, then replace this example with live Qloo discovery. These are illustrative results.';
  }
}
function renderTable(p, selected) {
  byId('candidate-table').innerHTML = `<table><caption class="small">${p.candidates.length} books in this evidence universe</caption><thead><tr><th scope="col">Book</th>${p.boards.map((b,i)=>`<th scope="col">${i+1}. ${esc(b.name)}</th>`).join('')}<th scope="col">Must-have</th><th scope="col">Stock</th></tr></thead><tbody>${p.candidates.map(c => `<tr class="${p.excluded.includes(c.id)?'unavailable':''}"><td>${esc(c.title)}<small>${selected.includes(c.id)?'<span class="chosen-tag">On the table</span>':''}${esc(c.author || 'Returned by Qloo')}</small></td>${c.scores.map(s=>`<td class="score">${s}</td>`).join('')}<td><label class="stock-control"><input type="checkbox" data-pin="${esc(c.id)}" ${p.pinned.includes(c.id)?'checked':''} aria-label="Pin ${esc(c.title)}">Pin</label></td><td><label class="stock-control"><input type="checkbox" data-stock="${esc(c.id)}" ${p.excluded.includes(c.id)?'':'checked'} aria-label="${esc(c.title)} available">Available</label></td></tr>`).join('')}</tbody></table>`;
}
export function renderVerification(result, label = 'Current slate') {
  const el = byId('verification');
  if (!result.valid) { el.innerHTML = `<strong>Receipt check failed.</strong><p>${esc(result.reason)}</p>`; return; }
  el.innerHTML = `<span class="verified">Checked, independently.</span>${esc(label)}: both choices are feasible and optimal for their stated objective. ${result.balanced.evaluated.toLocaleString()} alternatives replayed per objective.<div class="digest">SHA-256 ${esc(result.sha256)}</div>`;
}
