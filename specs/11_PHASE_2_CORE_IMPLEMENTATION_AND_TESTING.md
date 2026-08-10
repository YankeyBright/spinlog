# Phase 2: Core Implementation and Testing

## Goal

Implement and prove the frozen v1 contract. Runtime behavior and deterministic tests ship together; Phase 2 may not revise Phase 0 implicitly.

## Runtime Modules

1. `src/ansi.ts`
   - Apply capability-approved color to spinner frames and statuses.
2. `src/env.ts`
   - Implement the frozen color and animation precedence independently.
   - Detect TTY, CI, dumb terminal, test mode, and the Windows Unicode heuristic.
3. `src/spinner.ts`
   - Implement every state and transition from `specs/v1-behavior.json`.
   - Own only instance timers, cursor state, mutation fields, and stderr rendering.
   - Contain synchronous write failure without owning host signals or stream errors.
4. `src/index.ts`
   - Export the callable default factory, exact types, exact styles, and the two promise overloads.
   - Export nothing listed as deferred or permanently excluded.
5. `src/styles.ts`
   - Export the exact 38 side-effect-free style helpers.
   - Reject invalid JavaScript input consistently and preserve nested SGR behavior.
   - Provide the independently tree-shakeable `spinlog/styles` entrypoint.

## Required Behavior Tests

- ANSI tests prove every style sequence, disabled output, and nested restoration.
- Environment tests prove `NO_COLOR`, `FORCE_COLOR`, CI, dumb-terminal, test, TTY, and Unicode decisions.
- Spinner tests use fake timers and controlled stderr writes to prove immediate render, 80ms cadence, all legal transitions, idempotency, mutation, static degradation, cleanup, and write-failure containment.
- Process-ownership tests prove no signal or exit listeners are installed and no host termination API is invoked.
- Promise tests prove both overloads, thenable assimilation, callback ordering, synchronous throws, exact value/reason preservation, and cosmetic-failure isolation.
- Contract tests compare emitted declarations and runtime exports against Phase 0.
- Declaration comparison uses direct TypeScript emit, TypeScript CLI compilation, pinned Biome canonicalization, and negative/positive consumer type fixtures. It does not depend on TypeScript 7's unstable compiler API.
- Packed-consumer tests install the actual tarball and validate package-name imports, module-resolution profiles, stderr output, and timer ownership.

Tests make no network calls. Every source file maintains 100% statements, branches, functions, and lines globally and per file.

## Explicit Exclusions

All entries in `specs/16_POST_MVP_FEATURES.md`, CommonJS, and browser-first support remain unavailable.

## Definition Of Done

```bash
npm run test:coverage
npm run check:phase0
npm run check:phase1
npm run check:phase2
npm run check:phases
npm audit --audit-level=low
```

The ordered aggregate success record is `{"phase0":"pass","phase1":"pass","phase1Release":"pass","phase2":"pass"}`. The runtime is complete only when behavior, declaration, stream, ownership, ESM, size, package, SBOM, and release-policy checks all pass. An over-budget implementation remains incomplete even when every behavioral test passes.
