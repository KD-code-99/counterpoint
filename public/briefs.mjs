import {esc} from './render.mjs';
const types = [['movie','Film'],['artist','Music artist'],['book','Book'],['tv_show','TV series'],['podcast','Podcast'],['videogame','Video game']];
export function setupBriefs({api, onDiscover, setBusy}) {
  let briefs = [{name:'Other worlds', seeds:[]}, {name:'After-hours city', seeds:[]}];
  const root = document.getElementById('brief-editor'), error = document.getElementById('builder-error');
  const fail = message => { error.textContent = message; error.hidden = false; };
  function render() {
    root.innerHTML = briefs.map((b,i) => `<section class="brief-edit" data-brief="${i}"><div class="brief-top"><label>Brief ${i+1}<input data-name="${i}" value="${esc(b.name)}" maxlength="80" aria-label="Name for brief ${i+1}"></label>${briefs.length>2?`<button class="text-button" data-remove="${i}" aria-label="Remove brief ${i+1}">Remove</button>`:''}</div><div class="search-line"><input data-query="${i}" placeholder="Search a public cultural reference" aria-label="Search cultural reference for brief ${i+1}" maxlength="100"><select data-type="${i}" aria-label="Cultural category for brief ${i+1}">${types.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select><button class="secondary" data-search="${i}">Search</button></div><div class="seed-chips">${b.seeds.map((s,j)=>`<span class="seed-chip">${esc(s.name)}<button data-seed="${i},${j}" aria-label="Remove ${esc(s.name)} from brief ${i+1}">×</button></span>`).join('')}</div><div data-results="${i}" class="search-status" role="status" aria-live="polite"></div></section>`).join('');
    document.getElementById('add-brief').disabled = briefs.length >= 4;
  }
  root.addEventListener('input', e => { if (e.target.dataset.name !== undefined) briefs[Number(e.target.dataset.name)].name = e.target.value; });
  root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.query !== undefined) { e.preventDefault(); root.querySelector(`[data-search="${e.target.dataset.query}"]`).click(); } });
  root.addEventListener('click', async e => {
    const target = e.target.closest('button'); if (!target) return;
    if (target.dataset.remove !== undefined) { briefs.splice(Number(target.dataset.remove),1); render(); return; }
    if (target.dataset.seed) { const [i,j]=target.dataset.seed.split(',').map(Number); briefs[i].seeds.splice(j,1); render(); return; }
    if (target.dataset.search === undefined) return;
    const i = Number(target.dataset.search), board = briefs[i], results = root.querySelector(`[data-results="${i}"]`);
    if (board.seeds.length >= 3) return fail('A brief can use up to three references. Remove one to try another.');
    target.disabled = true; error.hidden = true; results.textContent = 'Searching Qloo for exact matches…';
    try {
      const response = await api('search', {query: root.querySelector(`[data-query="${i}"]`).value, type: root.querySelector(`[data-type="${i}"]`).value});
      if (!root.contains(results) || briefs[i] !== board) return;
      results.innerHTML = response.entities.length ? '<p>Choose the reference you mean:</p>' : '<p>No matching references. Try a more specific title or another category.</p>';
      for (const entity of response.entities) {
        const button = document.createElement('button'); button.className = 'search-result';
        const title = document.createElement('span'); title.textContent = entity.name;
        const detail = document.createElement('small'); detail.textContent = `${entity.type.replace('urn:entity:','')}${entity.year ? ` · ${entity.year}` : ''} · ${entity.id.slice(0,8)}`;
        button.append(title, detail); button.addEventListener('click', () => {
          if (board.seeds.some(s => s.id === entity.id)) return fail('This reference is already in the brief.');
          board.seeds.push(entity); render();
        }); results.append(button);
      }
    } catch (err) { results.textContent = err.message; }
    finally { target.disabled = false; }
  });
  document.getElementById('add-brief').addEventListener('click', () => { if (briefs.length < 4) { briefs.push({name:`Brief ${briefs.length+1}`, seeds:[]}); render(); } });
  document.getElementById('discover').addEventListener('click', async () => {
    error.hidden = true;
    if (briefs.some(b => !b.name.trim() || !b.seeds.length)) return fail('Give every brief a name and at least one confirmed cultural reference.');
    setBusy(true, 'Qloo is discovering books, then ranking the shared pool…');
    try { const result = await api('discover', {briefs, slots: Number(document.getElementById('slots').value)}); await onDiscover(result); document.getElementById('briefs-dialog').close(); }
    catch (err) { fail(err.message); }
    finally { setBusy(false); }
  });
  render();
}
