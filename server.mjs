import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {makeHandler, headers} from './lib/http.mjs';

const api = makeHandler();
const types = {'.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript', '.svg': 'image/svg+xml'};
const allowed = new Set(['/index.html', '/style.css', '/app.mjs', '/render.mjs', '/briefs.mjs', '/favicon.svg']);
export const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://local').pathname;
  if (path.startsWith('/api/')) return api(req, res);
  const file = path === '/' ? '/index.html' : path;
  if (!['GET', 'HEAD'].includes(req.method) || !allowed.has(file)) { res.writeHead(404); return res.end('Not found'); }
  try {
    const data = await readFile(new URL(`./public${file}`, import.meta.url));
    res.writeHead(200, {...headers, 'Content-Type': `${types[file.slice(file.lastIndexOf('.'))]}; charset=utf-8`});
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4318);
  server.listen(port, '127.0.0.1', () => console.log(`Counterpoint: http://127.0.0.1:${port}`));
}
