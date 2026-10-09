// Stateless MCP Streamable HTTP, JSON response transport. No model, shell or file access.
const object = properties => ({type: 'object', properties, additionalProperties: false});
const arbitraryObject = {type: 'object', additionalProperties: true};
export const tools = [
  {name: 'counterpoint_search', description: 'Search public cultural entities through Qloo. Let the user choose an unambiguous result; preserve its proof for discovery.',
    inputSchema: {...object({query: {type: 'string', minLength: 2, maxLength: 100}, type: {type: 'string', enum: ['movie','artist','book','tv_show','podcast','videogame']}}), required: ['query','type']}},
  {name: 'counterpoint_discover', description: 'Discover Qloo books for 2–4 public cultural briefs, rerank their common pool, and return both a least-covered-first and total-first slate with receipts. Requires search result proofs. No individual profiling.',
    inputSchema: {...object({briefs: {type: 'array', minItems: 2, maxItems: 4, items: {...object({name: {type: 'string', maxLength: 80}, seeds: {type: 'array', minItems: 1, maxItems: 3, items: arbitraryObject}}), required: ['name','seeds']}}, slots: {type: 'integer', minimum: 1, maximum: 4}}), required: ['briefs']}},
  {name: 'counterpoint_curate', description: 'Replan a signed evidence snapshot after stock changes or pinning. Workshop mode uses invented books and is never live Qloo evidence. Exactness applies only to this finite universe and the declared rank-derived objective.',
    inputSchema: {...object({mode: {type: 'string', enum: ['live','workshop']}, snapshot: arbitraryObject, slots: {type: 'integer', minimum: 1, maximum: 4}, pinned: {type: 'array', items: {type: 'string'}}, excluded: {type: 'array', items: {type: 'string'}}}), required: ['mode','slots']}},
  {name: 'counterpoint_verify', description: 'Independently replay a Counterpoint receipt. Checks finite-universe feasibility and optimality, not Qloo authenticity or customer satisfaction.',
    inputSchema: {...object({receipt: arbitraryObject}), required: ['receipt']}}
].map(tool => ({...tool, annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: tool.name.includes('search') || tool.name.includes('discover')}}));

export async function mcp(body, run) {
  const error = (code, message) => ({jsonrpc: '2.0', id: body?.id ?? null, error: {code, message}});
  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string' || Array.isArray(body)) return error(-32600, 'Invalid JSON-RPC request.');
  if (body.id === undefined && body.method.startsWith('notifications/')) return null;
  if (body.id === undefined) return error(-32600, 'A request ID is required.');
  let result;
  if (body.method === 'initialize') result = {protocolVersion: '2025-03-26', capabilities: {tools: {}}, serverInfo: {name: 'counterpoint', version: '0.1.0'},
    instructions: 'Use only public cultural seeds. Confirm search matches with the curator. Scores are Qloo rank-derived evidence, not individual predictions. Preserve the signed snapshot when replanning.'};
  else if (body.method === 'ping') result = {};
  else if (body.method === 'tools/list') result = {tools};
  else if (body.method === 'tools/call') {
    const spec = tools.find(t => t.name === body.params?.name);
    if (!spec) return error(-32602, 'Unknown tool.');
    try {
      const output = await run(spec.name.slice('counterpoint_'.length), body.params.arguments ?? {});
      result = {content: [{type: 'text', text: JSON.stringify(output)}]};
    } catch (err) {
      result = {isError: true, content: [{type: 'text', text: JSON.stringify({error: err.status ? err.message : 'The curation tool could not complete.', code: err.code ?? 'INPUT_ERROR'})}]};
    }
  } else return error(-32601, 'Method not found.');
  return {jsonrpc: '2.0', id: body.id, result};
}
