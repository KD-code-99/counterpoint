import {InputError} from './problem.mjs';
import {makeQloo, discover} from './qloo.mjs';
import {makeSnapshots} from './snapshot.mjs';
import {curate} from './receipt.mjs';
import {verifyReceipt} from './checker.mjs';
import {workshop, workshopProvenance} from '../fixtures/workshop.mjs';

export function makeApplication({qloo = makeQloo(), snapshots = makeSnapshots()} = {}) {
  return async function run(action, input = {}) {
    if (action === 'health') return {name: 'Counterpoint', version: '0.1.0', qloo_configured: qloo.configured,
      live_status: qloo.configured ? 'configured; a successful discovery confirms access' : 'organizer-issued credential pending',
      limits: {briefs: 4, candidates: 24, slots: 4, qloo_calls_per_discovery: 8}};
    if (action === 'workshop') return {snapshot: null, ...curate(workshop, workshopProvenance)};
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new InputError('A JSON object is required.');
    if (action === 'search') {
      const response = await qloo.search(input.query, input.type);
      return {entities: response.entities.map(entity => ({...entity, proof: snapshots.issue({kind: 'search-entity', entity})})), trace: response.trace, cached: response.cached};
    }
    if (action === 'discover') {
      if (!Array.isArray(input.briefs)) throw new InputError('Cultural briefs are required.');
      const briefs = input.briefs.map(b => ({name: b.name, seeds: Array.isArray(b.seeds) ? b.seeds.map(seed => {
        const proof = snapshots.read(seed.proof);
        if (proof.kind !== 'search-entity') throw new InputError('Choose a cultural seed returned by search.');
        return proof.entity;
      }) : []}));
      const evidence = await discover(qloo, briefs);
      const snapshot = snapshots.issue({kind: 'book-evidence', ...evidence});
      const result = curate({...evidence, slots: input.slots ?? 2}, evidence.provenance);
      return {snapshot, ...result};
    }
    if (action === 'curate') {
      let evidence;
      if (input.mode === 'workshop') evidence = {...workshop, provenance: workshopProvenance};
      else {
        evidence = snapshots.read(input.snapshot);
        if (evidence.kind !== 'book-evidence') throw new InputError('A book-discovery snapshot is required.');
      }
      return curate({...evidence, slots: input.slots, pinned: input.pinned ?? [], excluded: input.excluded ?? []}, evidence.provenance);
    }
    if (action === 'verify') return verifyReceipt(input.receipt);
    throw new InputError('Unknown action.');
  };
}
