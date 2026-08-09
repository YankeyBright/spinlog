# Phase 0: Product and Spec Lock

## Goal

Freeze the v1 product boundary and the rules that every later phase must preserve. Phase 0 changes documentation and policy only; it does not implement runtime behavior or publish the package.

## Required Deliverables

1. `docs/mvp-contract.md` defines the complete v1 surface:
   - colors
   - spinner lifecycle transitions
   - live mutation of text, color, prefix, and suffix
   - promise wrapping
   - stderr-first output
   - zero runtime dependencies
   - ESM-only Node >=18 support
   - the 1,228-byte gzip budget
2. `docs/post-mvp.md` explicitly defers task groups, progress bars, prompts, intro/outro helpers, and structured JSON logging.
3. `docs/stream-policy.md` reserves stdout and routes all v1 cosmetic output to stderr.
4. `docs/package-identity.md` freezes the package name, author, repository, license, runtime floor, module format, and keywords.
5. `harness/invariants.md` records the non-negotiable package, release, coverage, and phase-contract controls.
6. `docs/phase-map.md` defines one phase taxonomy for the specifications, harness, README, and automated gates.

## Explicit Non-Goals

- No color, spinner, signal, environment, mutation, or promise-wrapper implementation.
- No task groups, progress bars, prompts, intro/outro helpers, or structured logging.
- No package publication.

## Definition of Done

```bash
npm run check:phase-map
npm run check:phase0
```

Both commands must exit successfully. The Phase 0 checker verifies the frozen product contract, deferred scope, stream policy, package identity, and zero-runtime-dependency rule.
