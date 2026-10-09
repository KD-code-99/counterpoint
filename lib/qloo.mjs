import {createHash} from 'node:crypto';
import {InputError, canonical} from './problem.mjs';

const TYPES = new Set(['movie', 'artist', 'book', 'tv_show', 'podcast', 'videogame']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class ProviderError extends Error {
  constructor(code, message, status = 503) { super(message); this.code = code; this.status = status; }
}
export function publicEntity(row) {
  const id = row?.entity_id ?? row?.id;
  if (!UUID.test(id) || typeof row?.name !== 'string' || !row.name.trim()) return null;
  return {id: id.toLowerCase(), name: row.name.slice(0, 240), type: String(row.type ?? '').slice(0, 80),
    year: Number.isInteger(row.properties?.release_year) ? row.properties.release_year : null};
}
function entities(body) {
  const rows = Array.isArray(body?.results) ? body.results : body?.results?.entities;
  if (!Array.isArray(rows)) throw new ProviderError('QLOO_SCHEMA', 'Qloo returned an unsupported response shape. No substitute evidence was used.', 502);
  const found = rows.map(publicEntity);
  if (found.some(x => x === null)) throw new ProviderError('QLOO_SCHEMA', 'A Qloo entity was missing its identifier or title. The response was not used.', 502);
  return [...new Map(found.map(row => [row.id, row])).values()];
}
export function makeQloo({key = process.env.QLOO_API_KEY, base = process.env.QLOO_API_BASE ?? 'https://api.qloo.com', fetcher = fetch, timeout = 15000} = {}) {
  // Event hosts must be selected explicitly by the operator, never by an HTTP caller.
  if (!['https://api.qloo.com', 'https://hackathon.api.qloo.com'].includes(base)) throw new Error('Unsupported Qloo API host.');
  const cache = new Map();
  let windowAt = Date.now(), calls = 0;
  async function request(path, query) {
    if (!key) throw new ProviderError('QLOO_ACCESS_PENDING', 'Live discovery is waiting for the organizer-issued Qloo credential. The workshop uses clearly labeled invented data.');
    const cacheKey = canonical({path, query});
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return {...structuredClone(cached.value), cached: true};
    if (Date.now() - windowAt > 60000) { windowAt = Date.now(); calls = 0; }
    if (++calls > 60) throw new ProviderError('LOCAL_RATE_LIMIT', 'The demo request budget is busy. Try again in a minute.', 429);
    const url = new URL(path, base);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
    const started = performance.now();
    let response;
    try { response = await fetcher(url, {headers: {'X-Api-Key': key, Accept: 'application/json'}, signal: AbortSignal.timeout(timeout), redirect: 'error'}); }
    catch { throw new ProviderError('QLOO_UNREACHABLE', 'Qloo did not respond within the request window. Your current slate is preserved.'); }
    if (!response.ok) {
      if ([401, 403].includes(response.status)) throw new ProviderError('QLOO_AUTH', 'Qloo rejected the server credential. Live discovery is unavailable.');
      if (response.status === 429) throw new ProviderError('QLOO_QUOTA', 'Qloo reports a quota or rate limit. Try later; no substitute data was used.', 429);
      throw new ProviderError('QLOO_UPSTREAM', `Qloo returned HTTP ${response.status}. No substitute data was used.`, 502);
    }
    if (Number(response.headers.get('content-length')) > 2_000_000) throw new ProviderError('QLOO_SCHEMA', 'Qloo response exceeded the evidence limit.', 502);
    const raw = await response.text();
    if (raw.length > 2_000_000) throw new ProviderError('QLOO_SCHEMA', 'Qloo response exceeded the evidence limit.', 502);
    let body;
    try { body = JSON.parse(raw); } catch { throw new ProviderError('QLOO_SCHEMA', 'Qloo returned invalid JSON.', 502); }
    if (body.success === false) throw new ProviderError('QLOO_UPSTREAM', 'Qloo did not accept the request.', 502);
    const value = {entities: entities(body), trace: {path, query, fetched_at: new Date().toISOString(),
      duration_ms: Math.round(performance.now() - started), response_sha256: createHash('sha256').update(raw).digest('hex')}, cached: false};
    cache.set(cacheKey, {expires: Date.now() + 300000, value});
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    return structuredClone(value);
  }
  return {
    configured: Boolean(key),
    async search(query, type) {
      if (typeof query !== 'string' || query.trim().length < 2 || query.length > 100 || !TYPES.has(type)) throw new InputError('Search needs 2–100 characters and a supported cultural category.');
      return request('/search', {query: query.trim(), types: `urn:entity:${type}`, take: 5});
    },
    async books(seeds, ids) {
      const response = await request('/v2/insights', {'filter.type': 'urn:entity:book', 'signal.interests.entities': seeds,
        ...(ids ? {'filter.results.entities': ids} : {}), take: ids?.length ?? 12});
      if (response.entities.some(e => e.type !== 'urn:entity:book' || (ids && !ids.includes(e.id)))) throw new ProviderError('QLOO_SCOPE', 'Qloo returned an entity outside the requested book pool. The response was not used.', 502);
      return response;
    },
  };
}
export function validateBriefs(input) {
  if (!Array.isArray(input) || input.length < 2 || input.length > 4) throw new InputError('Provide 2–4 cultural briefs.');
  const briefs = input.map((b, i) => {
    if (typeof b?.name !== 'string' || !b.name.trim() || b.name.length > 80 || !Array.isArray(b.seeds) || b.seeds.length < 1 || b.seeds.length > 3) throw new InputError('Every brief needs a name and 1–3 chosen Qloo entities.');
    const seeds = b.seeds.map(s => {
      if (!UUID.test(s?.id) || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 240 || ![...TYPES].some(t => s.type === `urn:entity:${t}`)) throw new InputError('Choose a valid public cultural entity from search.');
      return {id: s.id, name: s.name, type: s.type};
    });
    if (new Set(seeds.map(s => s.id)).size !== seeds.length) throw new InputError('A brief cannot contain a duplicate seed.');
    return {id: `brief-${i + 1}`, name: b.name.trim(), seeds};
  });
  if (new Set(briefs.map(b => b.name.toLowerCase())).size !== briefs.length) throw new InputError('Give each brief a different name.');
  return briefs;
}

export async function discover(qloo, input) {
  const briefs = validateBriefs(input);
  const first = await Promise.all(briefs.map(b => qloo.books(b.seeds.map(s => s.id))));
  // Round-robin inclusion prevents the first brief from taking the whole evidence budget.
  const pool = new Map();
  for (let rank = 0; rank < 12; rank++) for (const response of first) {
    const item = response.entities[rank];
    if (item && pool.size < 24) pool.set(item.id, item);
  }
  const ids = [...pool.keys()];
  if (!ids.length) throw new ProviderError('QLOO_EMPTY', 'Qloo found no books for these signals. Try different, clearly matched cultural references.', 422);
  const rankings = await Promise.all(briefs.map(b => qloo.books(b.seeds.map(s => s.id), ids)));
  const ranks = rankings.map(r => new Map(r.entities.filter(e => pool.has(e.id)).map((e, i) => [e.id, i + 1])));
  const candidates = [...pool.values()].map(c => ({id: c.id, title: c.name, author: '',
    scores: ranks.map(r => r.has(c.id) ? Math.round(1000 / r.get(c.id)) : 0)}));
  return {boards: briefs.map(({id, name}) => ({id, name})), candidates,
    provenance: {mode: 'live-qloo', live_qloo: true, provider: 'Qloo Insights API v2', briefs,
      score_rule: 'round(1000 / rank) in Qloo reranking of the common candidate pool. An unreturned book has 0 returned evidence, not evidence of dislike.',
      candidate_rule: 'Up to 12 books per brief; round-robin union capped at 24, then Qloo reranks that same pool for every brief.',
      rankings: ranks.map((map, i) => ({brief_id: briefs[i].id, ordered_ids: [...map.keys()]})),
      traces: [...first, ...rankings].map(({trace, cached}) => ({...trace, cached})),
      requests: first.length + rankings.length, network_requests: [...first, ...rankings].filter(x => !x.cached).length,
      note: 'Aggregate cultural associations, not personal predictions, inventory checks or sales forecasts.'}};
}
