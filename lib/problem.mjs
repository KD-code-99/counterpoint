export const LIMITS = Object.freeze({boards: 4, candidates: 24, slots: 4, score: 1000});

export class InputError extends Error {
  constructor(message) { super(message); this.name = 'InputError'; this.status = 400; }
}
const fail = message => { throw new InputError(message); };
const text = (value, label, max = 160) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${label} must be nonempty text, at most ${max} characters.`);
  return value.trim();
};
const unique = (values, label) => {
  if (new Set(values).size !== values.length) fail(`${label} must be unique.`);
};

export function validateProblem(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('A curation problem is required.');
  if (!Array.isArray(raw.boards) || raw.boards.length < 2 || raw.boards.length > LIMITS.boards) fail('Choose 2–4 cultural briefs.');
  const boards = raw.boards.map(b => ({id: text(b?.id, 'Brief ID', 80), name: text(b?.name, 'Brief name', 80)}));
  unique(boards.map(b => b.id), 'Brief IDs');
  if (!Array.isArray(raw.candidates) || raw.candidates.length > LIMITS.candidates) fail('The evidence universe must contain at most 24 books.');
  const candidates = raw.candidates.map(c => {
    if (!Array.isArray(c?.scores) || c.scores.length !== boards.length || c.scores.some(s => !Number.isSafeInteger(s) || s < 0 || s > LIMITS.score)) fail('Every book needs one integer evidence score (0–1000) per brief.');
    return {id: text(c.id, 'Book ID', 160), title: text(c.title, 'Book title', 240), author: typeof c.author === 'string' ? c.author.slice(0, 160) : '', scores: [...c.scores]};
  });
  unique(candidates.map(c => c.id), 'Book IDs');
  const slots = raw.slots;
  if (!Number.isSafeInteger(slots) || slots < 1 || slots > LIMITS.slots) fail('Choose 1–4 places in the slate.');
  const ids = new Set(candidates.map(c => c.id));
  const selection = (value, label) => {
    if (!Array.isArray(value) || value.length > LIMITS.candidates || value.some(x => typeof x !== 'string' || !ids.has(x))) fail(`${label} must refer to books in this evidence universe.`);
    unique(value, label);
    return [...value].sort();
  };
  return {boards, candidates: candidates.sort((a,b) => a.id.localeCompare(b.id, 'en')), slots,
    pinned: selection(raw.pinned ?? [], 'Pinned books'), excluded: selection(raw.excluded ?? [], 'Unavailable books')};
}

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}
