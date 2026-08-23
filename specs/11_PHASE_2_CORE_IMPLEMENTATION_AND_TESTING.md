# Phase 2: Core Implementation and Testing

## Goal

Implement and prove the frozen v1 contract. Runtime behavior and deterministic tests ship together; Phase 2 may not revise Phase 0 implicitly.

## Runtime Modules

1. `src/ansi.ts`
   - Own the canonical SGR registry, validation, and generic nesting normalization.
2. `src/ansi-metadata.ts` and `src/ansi-apply.ts`
   - Keep one canonical source of SGR metadata while preserving style-subpath tree shaking.
3. `src/env.ts`
   - Implement frozen named SGR, cursor, color, emphasis, animation, and Unicode capabilities independently.
   - Detect TTY, CI, dumb terminal, test mode, conservative terminal profiles, and the Windows Unicode heuristic.
4. `src/spinner.ts`
   - Implement every state and transition from `specs/v1-behavior.json`.
   - Own only instance timers, cursor state, mutation fields, static modes, terminal overrides, lazy render snapshots, and stderr rendering.
   - Contain synchronous write failure without owning host signals or stream errors.
5. `src/text.ts`
   - Share strict string validation and render-boundary terminal sanitization.
6. `src/renderer.ts`
   - Coordinate permanent stderr lines around the active frame and contain rendering failures.
7. `src/messages.ts`
   - Implement coordinated intro/outro flow lines with one contained stderr write.
8. `src/index.ts`
   - Export the callable default factory, exact types, exact styles, two promise overloads, and intro/outro properties.
   - Export nothing listed as deferred or permanently excluded.
9. `src/styles.ts`
   - Export the exact 38 side-effect-free style helpers.
   - Reject invalid JavaScript input consistently and preserve nested SGR behavior.
   - Provide the independently tree-shakeable `spinlog/styles` entrypoint.

## Required Behavior Tests

- ANSI tests prove every style sequence, color-only disable behavior, metadata-driven nesting restoration, and reset boundaries.
- Environment tests prove `NO_COLOR` and `NODE_DISABLE_COLORS` override `FORCE_COLOR` for colors while preserving known-profile interactive emphasis, plus CI, dumb-terminal, test, TTY, automatic profile selection, explicit terminal overrides, and Unicode decisions.
- Spinner tests use fake timers and controlled stderr writes to prove immediate render, 80ms cadence, all legal transitions, validation-before-idempotency, lazy snapshot invalidation, static modes, static degradation, coordinated instance logs, cleanup, and write-failure containment.
- Process-ownership tests prove no signal or exit listeners are installed and no host termination API is invoked.
- Promise tests prove both overloads, thenable assimilation, callback ordering, synchronous throws, exact value/reason preservation, and cosmetic-failure isolation.
- Flow-message tests prove Unicode and ASCII markers, marker-only lines, marker-only color, validation order, sanitization, one-write stderr output, failure containment, timer/listener absence, and active-frame coordination.
- Terminal-emulation tests replay ANSI transcripts at narrow widths and prove that coordinated messages leave the final screen intact.
- Contract tests compare emitted declarations and runtime exports against Phase 0.
- API Extractor validates the frozen root and styles declarations and their emitted counterparts against tracked semantic reports. Documentation-only edits do not change report parity; export, overload, property, or return-type drift does.
- Packed-consumer tests install the actual tarball and validate package-name imports, module-resolution profiles, stderr output, and timer ownership.
- The tree-shaking proof keeps a single `spinlog/styles` export at or below the frozen 600-byte gzip ceiling and at least three times smaller than the root import.

Tests make no network calls. Every source file maintains 100% statements, branches, functions, and lines globally and per file.

## Explicit Exclusions

All entries in `specs/16_POST_MVP_FEATURES.md`, including multi-row concurrent animation, plus CommonJS and browser-first support remain unavailable.

## Definition Of Done

```bash
npm run test:coverage
npm run check:phase0
npm run check:phase1
npm run check:phase2
npm run check:foundation
npm audit --audit-level=low
```

The Phase 2 gate and `check:foundation` are independent of Phase 3 evidence. The final aggregate through Phase 4 is `{"phase0":"pass","phase1":"pass","phase1Release":"pass","phase2":"pass","phase3":"pass","phase4":"pass"}`. The runtime is complete only when behavior, declaration, stream, ownership, ESM, size, package, SBOM, and release-policy checks all pass. An over-budget implementation remains incomplete even when every behavioral test passes.
