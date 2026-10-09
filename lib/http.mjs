import {makeApplication} from './application.mjs';
import {mcp} from './mcp.mjs';
import {InputError} from './problem.mjs';

export const headers = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
async function readBody(req) {
  if (req.body !== undefined) {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(body) > 262144) throw new InputError('Request exceeds 256 KiB.');
    try { return JSON.parse(body); } catch { throw new InputError('Request must contain valid JSON.'); }
  }
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 262144) throw new InputError('Request exceeds 256 KiB.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { throw new InputError('Request must contain valid JSON.'); }
}
export function makeHandler(run = makeApplication()) {
  return async function handler(req, res) {
    const url = new URL(req.url, 'http://local');
    const action = url.searchParams.get('action') ?? url.pathname.replace(/^\/api\//, '');
    const send = (status, body) => { res.writeHead(status, {...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}); res.end(body === null ? '' : JSON.stringify(body)); };
    try {
      if (req.headers.origin) {
        let host;
        try { host = new URL(req.headers.origin).host; } catch { return send(403, {error: 'Invalid origin.'}); }
        if (host !== req.headers.host) return send(403, {error: 'Cross-origin requests are not accepted.'});
      }
      if (req.method === 'GET' && ['health','workshop'].includes(action)) return send(200, await run(action));
      if (req.method !== 'POST') return send(405, {error: 'Use POST with JSON for this route.'});
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, {error: 'Content-Type must be application/json.'});
      const body = await readBody(req);
      if (action === 'mcp') {
        const output = await mcp(body, run);
        return send(output === null ? 202 : 200, output);
      }
      return send(200, await run(action, body));
    } catch (err) {
      send(err.status ?? 500, {error: err.status ? err.message : 'The request could not complete.', code: err.code ?? 'REQUEST_ERROR'});
    }
  };
}
