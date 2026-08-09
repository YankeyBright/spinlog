# The Provable Ledger

This is not a simple to-do list. Every task here must be tied to a runnable command that proves the AI actually did the work, rather than just hallucinating a "looks good!" response.

You may not mark a task `[x]` until the attached Proof Command executes successfully and outputs the expected result. No "looks good" — show the terminal output.

All proof commands must exit 0. If non-zero, task is NOT done.

## Phase 0: Product and Spec Lock
- [x] **0.1 Freeze the canonical phase map and product boundary**
  - Evidence: `docs/phase-map.md`, the Phase 0-5 specifications, README status, and harness headings agree that runtime implementation starts in Phase 2.
  - Proof Command: `npm run check:phase-map`
- [x] **0.2 Freeze the v1 MVP and deferred feature lists**
  - Evidence: colors, spinner, state transitions, mutation, and promise wrapping are v1; groups, progress, prompts, intro/outro, and structured logs are post-MVP.
  - Proof Command: `npm run check:phase0`
- [x] **0.3 Freeze stream policy and package identity**
  - Evidence: cosmetic output is stderr-only, stdout is untouched in v1, and package name, author, repository, license, keywords, Node floor, and ESM format are explicit.
  - Proof Command: `npm run check:phase0`
- [x] **0.4 Bind Phase 0 requirements to the automated gate**
  - Evidence: `check:phase0` runs the phase-map validator first and rejects contract, deferred-scope, stream, identity, and dependency drift.
  - Proof Command: `npm run check:phase0`

## Phase 1: Package Scaffolding
- [x] **1.1 Establish the zero-runtime-dependency ESM package shell**
  - Evidence: the manifest, exports map, Node >=18 engine, publish allowlist, and lifecycle-script policy are machine checked.
  - Proof Command: `npm run policy:check && npm run check:phase1`
- [x] **1.2 Configure deterministic JavaScript and declaration builds**
  - Evidence: TypeScript `7.0.2` uses `Node18`/`Node16`; tsup emits minified ESM JavaScript; `tsc --emitDeclarationOnly` emits `dist/index.d.ts`; no CommonJS or source maps are produced.
  - Proof Command: `npm run typecheck && npm run build && node scripts/check-phase1.mjs`
- [x] **1.3 Enforce lint, tests, and 100% per-file source coverage**
  - Evidence: the inert package-shell entry point and policy validators are tested without claiming v1 runtime behavior.
  - Proof Command: `npm run lint && npm run test && npm run test:coverage`
- [x] **1.4 Enforce size and package-payload limits**
  - Evidence: the minified ESM entry stays within 1,228 gzipped bytes and the tarball contains only the approved seven files.
  - Proof Command: `npm run size && npm run size:limit && npm run pack:check`
- [x] **1.5 Prepare trusted release and runtime-only SBOM controls**
  - Evidence: OIDC release policy, full action SHA pins, zero runtime SBOM components, patched esbuild resolution, and the Node 18/20/22/24 CI matrix are machine checked.
  - Proof Command (Node >=20.18.0): `npm run check:phase1:release`
- [x] **1.6 Prove the complete ordered foundation gate**
  - Expected final output: `{"phase0":"pass","phase1":"pass","phase1Release":"pass"}`
  - Proof Command (Node >=20.18.0): `npm run check:phases`

## Phase 2: Core Implementation and Testing
- [ ] **2.1 Implement ANSI colors and nested-style restoration with behavior tests**
  - Proof Command: `npm run test -- test/ansi.test.ts && npm run test:coverage`
- [ ] **2.2 Implement terminal capability, environment, stream, and signal behavior with tests**
  - Proof Command: `npm run test -- test/env.test.ts test/signal.test.ts test/stream.test.ts && npm run test:coverage`
- [ ] **2.3 Implement spinner state transitions and lifecycle cleanup with tests**
  - Proof Command: `npm run test -- test/spinner.test.ts && npm run test:coverage`
- [ ] **2.4 Implement live mutation and promise wrapping with tests**
  - Proof Command: `npm run test -- test/mutation.test.ts test/promise.test.ts && npm run test:coverage`
- [ ] **2.5 Prove the complete v1 runtime contract without post-MVP APIs**
  - Proof Command: `npm run check:phase0 && npm run check:phase1 && npm run test:coverage`

## Phase 3: Benchmarking and SBOM Hardening
- [ ] **3.1 Size gate <=1228 bytes gzipped**
  - Proof Command: `npm run build && npm run size && npm run size:limit && echo "PASS 3.1 size <=1228"`
- [ ] **3.2 size-limit config valid (if present)**
  - Proof Command: `npx size-limit --json | jq -e '.[0].size <= 1228' && echo "PASS 3.2 size-limit"`
- [ ] **3.3 Generate CycloneDX v1.5 SBOM**
  - Proof Command (Node >=20.18.0): `npm run sbom && test -f sbom.json && echo "PASS 3.3 sbom generated"`
- [ ] **3.4 Validate SBOM schema + zero-dep pedigree**
  - Proof Command: `npm run sbom:check && jq -e '.bomFormat=="CycloneDX" and .specVersion=="1.5" and (.components//[]|length==0) and .metadata.component.type=="library"' sbom.json && echo "PASS 3.4 sbom valid"`
- [ ] **3.5 Benchmark vs ora/chalk (optional but required for docs)**
  - Proof Command: `node bench/compare.mjs`

## Phase 4: Documentation and Migration
- [ ] **4.1 README highlights zero-dep, no lifecycle scripts, provenance, size badge**
  - Proof Command: `grep -q "zero" README.md -i && grep -q "provenance" README.md -i && grep -q "1228\|1.2" README.md && echo "PASS 4.1 readme"`
- [ ] **4.2 Document verification commands for auditors**
  - Proof Command: `grep -q "npm audit signatures" README.md && grep -q "sbom" README.md -i && echo "PASS 4.2 audit docs"`
- [ ] **4.3 Create codemod for chalk+ora -> spinlog migration**
  - Proof Command: `test -f codemods/migrate.js && node codemods/migrate.js --help 2>&1 | head -n 20 && echo "PASS 4.3 codemod exists"`
- [ ] **4.4 Verify pack contains only dist + sbom, no deps**
  - Proof Command: `npm run pack:check && echo "PASS 4.4 pack clean"`

## Phase 5: Trusted Release
- [ ] **5.1 Release workflow uses OIDC, provenance, and no long-lived tokens**
  - Proof Command: `grep -q "id-token: write" .github/workflows/release.yml && grep -q "npm publish --provenance" .github/workflows/release.yml && ! grep -q "NPM_TOKEN\|NODE_AUTH_TOKEN" .github/workflows/release.yml && echo "PASS 5.1 trusted publishing"`
- [ ] **5.2 Publish dry-run**
  - Proof Command: `npm publish --dry-run && echo "PASS 5.2 publish dry-run"`
- [ ] **5.3 Post-publish verification (run after real publish)**
  - Proof Command: `PACKAGE_VERSION=$(jq -r .version package.json); npm view spinlog@$PACKAGE_VERSION --json | jq -e '.dist.attestations != null' && npm audit signatures && echo "PASS 5.3 provenance verified"`
- [ ] **5.4 Submit to scorecard / e18e**
  - Proof Command: `test -f docs/scorecard.md && echo "PASS 5.4 trust building"`

---

## Final Done Check - Run ALL gates
```bash
# This is harness/done.md in one command
npm run check:phases && npm run verify:release && npm audit --audit-level=low && echo "ALL GATES PASS - DONE"
```

> **Rule Reminder:** If you mark `[x]` without pasting the Proof Command output, you are hallucinating.
