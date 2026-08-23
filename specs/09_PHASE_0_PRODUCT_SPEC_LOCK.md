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

- v1 includes ANSI-16 named style helpers, one interactive terminal lease, one spinner with `start`, `stop`, `log`, `succeed`, `fail`, `warn`, `info`, and `Symbol.dispose`, live mutation of `text`, `color`, `prefix`, and `suffix`, static modes, terminal-mode overrides, both frozen `spinlog.promise()` overloads, and coordinated `spinlog.intro()`/`spinlog.outro()` flow messages.
- The package is ESM-only, supports Node 22, Node 24, and Node 26, and has zero runtime, optional, and peer dependencies.
- Style helpers are side-effect-free and stream-free. Spinner frames, statuses, intro lines, and outro lines write only to `stderr`; v1 never writes to `stdout`.
- User text is sanitized only at the rendering boundary, active write failure moves the current cycle to `stopped`, and terminal state never depends on cosmetic I/O success.
- Named capabilities are frozen as SGR, cursor control, color, emphasis, animation, and Unicode. Automatic animation requires a conservative terminal profile after highest-to-lowest color precedence: `NO_COLOR`, `NODE_DISABLE_COLORS`, `FORCE_COLOR`, CI, dumb terminal, test mode, stderr TTY capability, and profile recognition. Explicit color-disable variables affect colors only on known capable interactive terminals; `terminal: 'interactive'` is an informed TTY-only override that never enables color itself.
- The library installs no process signal or exit listener and never terminates the host process.
- `dist/index.js` may not exceed 4,096 bytes after gzip level 9.
- Every feature outside this boundary is either listed with exact rationale in `specs/16_POST_MVP_FEATURES.md` or declared a permanent non-goal in the behavior contract.

## Size Budget Decision

The original micro-budget was retired before publication. Coordinated flow rendering, conservative width safety, static secondary spinners, and disposal require a realistic 4,096-byte ceiling. This is a versioned contract revision, not a checker bypass: the machine contract, independent size controls, mutation tests, and all normative documentation enforce the same ceiling.

The esbuild single-style consumer proof remains capped at 600 gzip bytes. Schema v8 preserves this separate tree-shaken style ceiling without weakening style behavior.

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
