# Counterpoint

A bookshop curation tool that gives every cultural brief a way into a small reading slate.

**Preview status, 9 October 2026:** the workshop, optimizer, independent verifier, HTTP API and MCP tools work. Live Qloo discovery is implemented against the documented contract but awaits an individually issued event API credential. No live Qloo outcome or completed hackathon submission is claimed. All checked-in book titles and scores in the workshop are invented test data.

## Try the decision

Run with Node.js 24 (22.19+ supported):

```sh
node server.mjs
```

Open `http://127.0.0.1:4318`. No dependency installation or API key is needed for the clearly labeled workshop.

1. Compare the least-covered-first slate with the exact total-first alternative.
2. Mark a selected book unavailable. Both choices adapt to the same constraint.
3. Pin a must-have; try making it unavailable to see the explicit conflict.
4. Download a decision receipt, reload, and check the saved file.
5. Print a reading slate. The workshop label remains on the printout.

For live discovery, select 2–4 public cultural briefs and confirm their film, artist, book, television, podcast or game references. The server asks Qloo for books, forms a bounded shared pool, and asks Qloo to rerank that pool against every brief. The ranking step is response-dependent: it uses identifiers returned by the first step.

## Why it is different

A recommendation list optimizes one set of signals. An editorial table has several briefs and only a few places. Counterpoint makes the tradeoff visible: maximize the least-covered brief first, or maximize total coverage. It computes both exactly over the supplied pool, preserves stock and pin constraints, and includes an independent exhaustive replay.

The mechanism does not guarantee a commercially better display. Rank-based coverage is a declared editorial objective, not an enjoyment probability or sales forecast. Read [the method and its limits](docs/METHOD.md).

## Qloo setup

Obtain your own authorized credential from the event organizer. Keep it server-side. The app reads `QLOO_API_KEY` and `QLOO_API_BASE`; it never reads browser storage, private harness configuration or another person's credential. The organizer's event starter email specifies `https://hackathon.api.qloo.com` for hackathon keys, so `.env.example` selects it. The adapter's generic default is `https://api.qloo.com`; set the event base explicitly when using an event credential.

```sh
# After filling .env locally; never commit it:
node --env-file=.env server.mjs
```

See `.env.example`. Authentication, quota, empty-result, schema and timeout failures are explicit. There is no silent fixture fallback. One discovery uses 4–8 Qloo requests, with a five-minute, 100-entry process-local cache. The 60-request/minute guard is per process, not a distributed quota guarantee. A public deployment needs a provider quota and deployment-level abuse controls appropriate to its traffic.

No personal identities, demographic attributes, customer records or sensitive traits are sent to Qloo. Stock, price and reading rights are the operator's responsibility. Only public cultural names and returned identifiers are used.

## Agent tools

Connect an MCP Streamable HTTP client to `http://127.0.0.1:4318/api/mcp` (or `/api/mcp` on your deployment).

| Tool | Purpose |
|---|---|
| `counterpoint_search` | Return cultural entities with signed selection proofs; the curator confirms the match. |
| `counterpoint_discover` | Use the chosen proofs, discover and rerank books, and produce both slates. |
| `counterpoint_curate` | Replan a signed snapshot after stock or pin changes. No new Qloo call. |
| `counterpoint_verify` | Replay a saved receipt with a separate enumerator. |

Workshop example: call `counterpoint_curate` with `{"mode":"workshop","slots":2}`. Live mode requires the snapshot returned by `counterpoint_discover`. The tools are read-only: they cannot buy books, send messages or alter stock systems. Both default legacy and automatic negotiation were exercised with the official `@modelcontextprotocol/client` 2.3.1; see [interop evidence](evidence/mcp-interop.json).

## Verify

```sh
node --test tests/*.test.mjs
node scripts/verify-receipt.mjs evidence/browser-workshop-receipt.json
```

The tests compare the solver with a separate bitmask oracle on 250 generated problems, test constraints and rehashed false optimality claims, and exercise HTTP, provider and MCP error paths. Provider responses in these tests are controlled transport fixtures, not live data.

Optional browser/client acceptance tools are pinned as development dependencies:

```sh
npm ci --ignore-scripts
npx playwright install chromium
# Keep node server.mjs running in another terminal:
node tests/browser.cjs
node tests/mcp-interop.cjs
```

`CHROME_PATH` can select an installed browser. `COUNTERPOINT_URL` can point acceptance checks at your own public deployment. Browser screenshots and reports are under `evidence/`; their scope is the workshop, not Qloo performance. See [acceptance status](docs/ACCEPTANCE.md) for the remaining release gates.

## Architecture and deployment

The runtime has no third-party dependencies. Native Node HTTP/fetch/crypto serve the application. The official Qloo harness is a pinned development reference, not a model runtime inside the product. Its `0.1.26` API contracts and [Qloo's public documentation](https://docs.qloo.com/) informed the adapter. [The official event starter](https://github.com/qloo/qloo-hackathon-kit) supplies the access and safe-use guidance; no starter implementation is copied into this app.

- `lib/qloo.mjs`: bounded public-entity search, discovery, shared-pool reranking and provenance.
- `lib/solver.mjs`: recursive exhaustive slate selection.
- `lib/checker.mjs`: independent iterative enumeration and rank-to-score consistency checks; does not import the solver.
- `lib/snapshot.mjs`: expiring HMAC-bound server snapshots and seed selections.
- `lib/http.mjs`, `lib/mcp.mjs`: shared JSON API and stateless MCP transport.
- `public/`: accessible HTML, CSS and browser modules, without third-party scripts or tracking.

For Vercel, use Node 24, `public` as the output directory, the supplied `vercel.json`, and an empty build command. `npm ci --omit=dev --ignore-scripts` avoids installing the optional testing/harness dependencies. Put the event credential only in encrypted production environment variables. Do not deploy the private state/strategy files.

## Attribution

New implementation by KD demirci with AI assistance. The project adapts the author's earlier engineering patterns—explicit assumptions, verifiable receipts and an independent checker—to a new curation problem. It does not claim a new optimization theorem. UI typography uses system fonts; the icon and illustrative covers are authored SVG/CSS. The MIT license covers this repository's original code and invented fixtures; Qloo data remains subject to its provider terms.
