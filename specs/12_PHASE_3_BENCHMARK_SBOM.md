# Phase 3: Benchmarking and SBOM Hardening

## Goal

Produce reproducible performance and supply-chain evidence for the completed Phase 2 runtime. Phase 3 does not publish the package, claim production readiness, or claim SLSA conformance.

## Benchmark Evidence

- The dependency-free benchmark harness measures built root and `spinlog/styles` cold imports, enabled and disabled style throughput, static spinner settlement, and resolved promise-wrapper overhead.
- Every full run uses warmups, calibrated iterations, at least 30 samples, median, p95, median absolute deviation, and a deterministic bootstrap confidence interval.
- Relative median absolute deviation above 15% is inconclusive. The harness retries a scenario up to three times, then fails instead of accepting noisy evidence.
- `bench/baseline.json` is tracked only after aggregation of five independent Node 24 Linux CI matrix jobs. Every input records the same commit and workflow attempt, a unique matrix slot, and a unique SHA-256 artifact digest. A baseline is not fabricated from a developer workstation.
- CI writes the aggregate only to `artifacts/phase3/baseline-candidate.json`. A reviewer must accept and commit it in a separate change; candidate verification never overwrites the tracked baseline or compares a candidate against a baseline produced from itself.
- A median regression above 25% with a non-overlapping confidence interval is a warning. Candidate verification fails above 2x baseline when the candidate lower confidence bound is above 1.5x baseline median.

```bash
npm run benchmark:smoke
npm run benchmark
npm run benchmark:check
```

The 2,560-byte gzip ceiling for `dist/index.js` remains a hard Phase 0 size contract, independently enforced by `npm run size` and `npm run size:limit`.

## SBOM Evidence

`npm run sbom` retains the runtime-only CycloneDX 1.5 library SBOM that is packaged with the library. It has a canonical root identity, MIT license, description, website, issue tracker, VCS reference, reproducibility marker, and a zero-component runtime graph.

`npm run sbom:build` creates a separate canonical CycloneDX 1.5 build-tool inventory from the complete development dependency graph. It proves direct build-tool presence and canonical graph ordering, but is never included in the npm tarball.

```bash
npm run sbom
npm run sbom:check
npm run sbom:build
npm run sbom:build:check
```

Build SBOMs, benchmark results, candidate manifests, and baseline candidates live under ignored `artifacts/phase3/` and are CI artifacts until Phase 5.

## Reproducibility And Candidate Evidence

`npm run reproducibility:check` performs a fast double build, SBOM generation, and pack comparison. Candidate verification repeats that proof in two clean temporary workspaces with independent `npm ci --ignore-scripts` installations at different absolute paths.

Approved ESM JavaScript, declarations, source maps, both SBOMs, and the tarball must be byte-identical. `npm run candidate:manifest` then records the version, Git commit, Node/npm versions, file sizes, and SHA-256/SHA-512 digests for the candidate tarball and SBOMs.

```bash
npm run reproducibility:check
npm run verify:candidate
```

`verify:candidate` requires a committed five-run Node 24 Linux benchmark baseline, a clean reproducibility proof, a dependency audit, actual packed-consumer validation, and the candidate manifest.

## Definition Of Done

```bash
npm run check:phase3
npm run verify:candidate
```

`npm run check:phases` remains the ordered Phase 0-through-Phase 2 foundation gate so baseline collection can run without a circular dependency on Phase 3. Phase 3 is complete only after the Node 22/24 quality matrix passes, the five Node 24 baseline jobs produce a reviewable baseline, that baseline is committed independently, and the Node 24 candidate job validates against it. The manual release-readiness workflow remains read-only; trusted publication, provenance, and post-publication verification remain Phase 5 work.
