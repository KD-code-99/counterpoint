# Acceptance gates

- [x] Registration readback confirms Qloo registration and the user has agreed to current rules.
- [ ] Sponsor-issued Qloo access configured without exposing secrets to browser, logs or repository.
- [x] Documented API contracts inspected against official harness 0.1.26 and implemented; live schema validation remains pending.
- [ ] Real cross-domain Qloo discovery and response-dependent second pass recorded.
- [x] UI requires an explicit search match; server verifies its signed selection proof. Tested with controlled transport fixtures.
- [x] Finite candidate normalization preserves provenance and does not fabricate missing affinities. Tested with controlled transport fixtures.
- [x] Optimizer respects all availability, pin and slot constraints.
- [x] Independent checker rejects edited receipt inputs, changed result, suboptimal selections and inconsistent recorded ranks.
- [x] Differential/randomized tests compare optimizer to a structurally independent exhaustive oracle (250 cases, both objectives).
- [x] Tests cover ties, missing evidence, all-zero scores, impossible pins, full exclusion and request limits.
- [x] Provider errors, transport failures and quota responses are visible and bounded in controlled tests.
- [ ] Paired aggregate-first and least-covered-first measurements use actual Qloo evidence.
- [x] Responsive checks at 320/768/1024/1440px; keyboard dialog/search controls pass. Axe 4.14.0 found no violations; color-contrast has an incomplete item requiring human review. This is not a WCAG conformance claim.
- [x] Export and print affordances work; receipt verification works after page reload. Print retains the workshop label.
- [x] Official MCP client 2.3.1 exercises discovery of four tools, workshop curation, receipt verification and access errors in legacy and automatic negotiation modes.
- [ ] Vercel public production endpoint tested without credentials.
- [ ] Public repo and release have complete source/license/provenance, no secrets, no unsupported claims.
- [ ] Devpost required fields and images uploaded; entry submitted and read back from Devpost.

21 Node tests passed on 9 October 2026. Browser and interoperability reports are in `evidence/`. All numerical results in these reports are fixture results; no live Qloo benchmark has been recorded.
