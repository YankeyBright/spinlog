# Phase 0: Product and Spec Lock

## Goal

Freeze the exact v1 product surface and behavior that every later phase must preserve. Phase 0 changes contracts, policy, and validation only; it does not implement runtime behavior or publish the package.

## Required Deliverables

1. `specs/v1-public-api.d.ts` and `specs/v1-styles-api.d.ts` declare every public value, type, option, overload, property, parameter, return type, and subpath export.
2. `specs/v1-behavior.json` closes package identity, Node support, size, defaults, safe single-line rendering, environment precedence, state transitions, promise semantics, process ownership, write failure, deferred features, and non-goals.
3. `specs/06_CORE_API_SPEC.md` explains the machine contracts without expanding their surface.
4. `specs/16_POST_MVP_FEATURES.md` contains every deferred API with its exact rationale.
5. `specs/05_TERMINAL_SPEC.md` distinguishes side-effect-free style helpers from stderr-owned spinner rendering and reserves stdout.
6. `package.json`, `README.md`, and the behavior contract bind the public `YankeyBright/spinlog` repository to npm metadata and trusted publishing.
7. `specs/00_PHASE_MAP.md` records the permanent phase taxonomy.

## Frozen MVP Summary

- v1 includes ANSI-16 named style helpers, one spinner with `start`, `stop`, `succeed`, `fail`, `warn`, and `info`, live mutation of `text`, `color`, `prefix`, and `suffix`, and both frozen `spinlog.promise()` overloads.
- The package is ESM-only, supports the Node 22 and Node 24 LTS majors, and has zero runtime, optional, and peer dependencies.
- Style helpers are side-effect-free and stream-free. Spinner frames and statuses write only to `stderr`; v1 never writes to `stdout`.
- User text is sanitized only at the rendering boundary, active write failure moves the current cycle to `stopped`, and terminal state never depends on cosmetic I/O success.
- Color precedence is frozen highest-to-lowest as `NO_COLOR`, `NODE_DISABLE_COLORS`, `FORCE_COLOR`, CI, dumb terminal, test mode, and stderr TTY capability.
- The library installs no process signal or exit listener and never terminates the host process.
- `dist/index.js` may not exceed 2,560 bytes after gzip level 9.
- Every feature outside this boundary is either listed with exact rationale in `specs/16_POST_MVP_FEATURES.md` or declared a permanent non-goal in the behavior contract.

## Size Budget Decision

Earlier pre-runtime budgets were retired before publication. After deterministic JavaScript input validation, a dedicated style-only entrypoint, direct esbuild output, and linked production source maps were finalized, the root artifact measured 2,279 bytes with Node gzip level 9. The 2,560-byte ceiling preserves every frozen API, terminal-safety, validation, stream, and host-ownership guarantee while retaining 281 bytes of explicit headroom. This is a versioned contract revision, not a checker bypass: the machine contract, independent size controls, mutation tests, and all normative documentation enforce the same ceiling.

## Explicit Non-Goals

- No ANSI, spinner, environment, mutation, or promise-wrapper runtime implementation.
- No post-MVP API or package publication.
- No global signal, process-exit, or stream-error ownership by the library.

## Definition Of Done

```bash
npm run check:phase-map
npm run check:phase0
```

The Phase 0 command runs mutation-tested structural validation, not phrase-presence checks. It rejects missing or extra API surface, changed overloads, incomplete transitions, non-idempotent settlement, missing deferral rationale, stream and process-ownership drift, unsupported Node policy, repository mismatch, and dependency drift.
