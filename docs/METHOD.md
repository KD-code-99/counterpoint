# A finite, checkable editorial choice

## From public signals to a common candidate pool

Each of 2–4 briefs has 1–3 curator-confirmed public cultural entities. Qloo `/search` returns candidates; signed selection proofs prevent relabeling or inventing server-returned matches. Qloo `/v2/insights` discovers up to 12 books per brief. A round-robin union retains up to 24 distinct books, so the first brief cannot exhaust the entire candidate budget.

A second set of `/v2/insights` calls uses `filter.results.entities` to rerank that same finite pool against each brief. The project does not infer one brief's evidence from a different brief's list. Empty and partial results remain explicit.

For book c and brief j, `s(c,j) = round(1000 / rank(c,j))`; an unreturned book has score 0. This converts ordinal ranks to a transparent, steeply decaying editorial score. It is a modeling choice, not Qloo's probability of enjoyment. Ranks from different briefs do not establish equal real-world utility. A zero means missing returned evidence, not dislike.

Qloo is material to the live product: it supplies the entity resolution, cross-domain candidate pool and common-pool ordering. Removing it leaves only the separately labeled invented workshop. No LLM invents book metadata or a cultural explanation.

## Two exact priorities

Choose exactly k books, where 1 ≤ k ≤ 4, retaining every pin and excluding every unavailable title. A brief's coverage is the maximum score among selected books. Repeatedly selecting books that serve the same already-covered brief does not add coverage to it.

The balanced objective sorts the brief coverages from low to high and maximizes that vector lexicographically (leximin). The total-first objective maximizes their sum, with leximin as a tiebreaker. Equal-objective slates have a deterministic identifier tiebreak.

At most `24 choose 4 = 10,626` unconstrained slates exist. The solver enumerates feasible combinations recursively. The checker uses a separate iterative enumeration and separate objective arithmetic. Tests add a third, bitmask-based oracle. None of these checks proves that the candidate discovery was globally complete or that the score is a valid measure of customer satisfaction.

## What the receipts establish

A receipt records normalized inputs, both outputs, scores, constraints, provenance, timestamp and SHA-256. In live mode, it records Qloo ranking order and verifies that every matrix cell follows the declared rank conversion. It preserves request parameters, timestamps, response hashes, measured durations and cache status without credentials.

Replay checks feasibility, arithmetic and objective optimality. A changed hash is rejected. A rehashed suboptimal solution is rejected with a better feasible counterexample. A rehashed inconsistency between ranks and scores is rejected.

The receipt hash is not a digital signature from Qloo. A self-consistent, fabricated external receipt could pass the arithmetic check; the checker does not claim data authenticity. During interactive use, HMAC-bound snapshots ensure that a client cannot alter provider evidence and still ask this server to present it as live. Those signatures expire after one day and depend on the deployment's server credential. Downloaded receipts remain independently replayable after expiration or credential rotation.

## Limits and honest comparisons

- The finite pool can miss good books. The 24-book cap is explicit, not a completeness claim.
- The returned order can change. Cached requests preserve their original timestamps; a new discovery can differ.
- Max coverage ignores how many equally good alternatives a brief receives. It protects representation by at least one book, not all notions of diversity or fairness.
- If both objectives choose equal coverage, the UI says there is no floor advantage to claim.
- All checked-in numerical examples are invented. The workshop's 390-vs-40 floor comparison is a designed explanation of the objective, not a Qloo benchmark or business result.
- Availability, prices and rights are not inferred. A pin/stock contradiction is infeasible, never quietly overridden.
- There are no customer interviews, testimonials, sales outcomes or causal uplift measurements claimed in this preview.
