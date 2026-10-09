import {createHmac, timingSafeEqual} from 'node:crypto';
import {canonical, InputError} from './problem.mjs';

export function makeSnapshots(key = process.env.QLOO_API_KEY) {
  const sign = body => createHmac('sha256', key).update('counterpoint-evidence-v1\n' + canonical(body)).digest('hex');
  return {
    issue(evidence) {
      if (!key) throw new InputError('Live evidence cannot be issued without Qloo access.');
      const body = {...evidence, expires_at: Date.now() + 86400000};
      return {...body, signature: sign(body)};
    },
    read(snapshot) {
      if (!key || !snapshot || typeof snapshot.signature !== 'string' || !/^[a-f0-9]{64}$/.test(snapshot.signature)) throw new InputError('A valid server-issued evidence snapshot is required.');
      const {signature, ...body} = snapshot;
      if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(sign(body), 'hex'))) throw new InputError('The evidence snapshot was edited. Discover fresh books to continue.');
      if (!Number.isSafeInteger(body.expires_at) || body.expires_at < Date.now()) throw new InputError('This evidence snapshot expired. Discover fresh books to continue.');
      return body;
    }
  };
}
