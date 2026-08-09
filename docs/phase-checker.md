# Phase Gate Checker

The phase checker provides deterministic, machine-verifiable proof that the completed Phase 0 product lock and Phase 1 package shell still meet their frozen contracts. It is a development and CI control only; it adds no published runtime dependency or public API.

## Commands

| Command | Minimum Node Version | Validates |
| --- | --- | --- |
| `npm run check:phase-map` | 18 | Canonical phase headings, responsibilities, and runtime boundary across the README, specifications, and harness. |
| `npm run check:phase0` | 18 | Phase-map policy first, then MVP scope, deferred features, stderr policy, package identity, and zero runtime dependency maps. |
| `npm run check:phase1` | 18 | Phase-map policy first, then package policy, TypeScript and tool configuration, esbuild override and lockfile safety, typecheck, lint, enforced V8 coverage, ESM build output, size limits, and package allowlist. |
| `npm run check:phase1:release` | 20.18 | Runtime SBOM generation and validation, release workflow OIDC policy, token absence, full-SHA GitHub Actions pinning, and CI gate wiring. |
| `npm run check:phases` | 20.18 | Runs the three checks above in that order and stops at the first failure. |

`check:phases` emits normal command output for human review. Its final successful line is a JSON summary intended for automation:

```json
{"phase0":"pass","phase1":"pass","phase1Release":"pass"}
```

On failure, it stops immediately and emits a JSON record naming the failed phase. CI must treat the command exit status as authoritative.

## Phase-Map Policy

[`phase-map.md`](phase-map.md) is the canonical numbering contract. The pure validator exported by `scripts/check-phase-map.mjs` checks the authoritative documents in memory; the same module provides the CLI wrapper used by npm. Regression tests prove that the canonical map passes and the former runtime-in-Phase-1 taxonomy fails.

Both `check:phase0` and `check:phase1` execute `check:phase-map` first. Phase 1 therefore cannot report success while an authoritative specification, README statement, or harness phase heading assigns runtime implementation to Phase 1.

## Coverage Policy

`npm run test` remains the fast local test command. `npm run test:coverage` is the quality gate used by `check:phase1` and `verify`.

Coverage includes every `src/**/*.ts` file and requires 100% statements, branches, functions, and lines globally and per file. The configuration extends Vitest's default coverage exclusions, explicitly includes untested source files, and disables automatic threshold updates. The Phase 1 checker also rejects standard V8, Istanbul, and C8 coverage-suppression directives in `src`.

## CI Ownership

The Node 18/20/22/24 quality matrix runs the Phase 0 and Phase 1 gates. The Node 24 supply-chain job and tag-driven release workflow run `npm run check:phases`, ensuring the release-only SBOM and workflow policy checks execute before `npm publish --provenance`.

The existing `verify` and `verify:release` commands remain available as focused compatibility commands. The phase gates are the authoritative compliance interface because they bind those checks to the frozen Phase 0/1 requirements.
