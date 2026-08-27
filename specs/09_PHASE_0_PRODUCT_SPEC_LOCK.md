# Phase 0: Product and Spec Lock

## Goal

Freeze the exact pre-1.0 `spinlog@0.2.0` product surface and behavior that every later phase must preserve. Phase 0 changes contracts, policy, and validation only; it does not authorize publication.

## Required deliverables

1. `specs/v1-public-api.d.ts` and `specs/v1-styles-api.d.ts` declare every public value, type, option, overload, property, parameter, return type, and subpath export.
2. `specs/v1-behavior.json` closes package identity, Node support, size, target policy, defaults, terminal safety, transitions, promise semantics, recovery, deferred features, and non-goals.
3. `specs/06_CORE_API_SPEC.md` and `specs/05_TERMINAL_SPEC.md` explain the machine contracts without expanding them.
4. `specs/16_POST_MVP_FEATURES.md` contains every deferred API with its exact rationale.
5. `package.json`, `README.md`, `MIGRATION.md`, SBOM metadata, and release-freeze policy bind the public contract to package evidence.

## Frozen pre-1.0 summary

- The API includes ANSI-16 styles, custom frames, explicit writable streams, one interactive lease per writable stream, groups, progress, static modes, terminal overrides, `color: false`, Unicode/cursor/indent controls, instance logs, disposal, promise settlement text, and target-aware intro/outro flow messages.
- Groups enforce target width and height. `maxRows` defaults to `min(10, target.rows - 1)`, static/settled rows persist, and an idle group session may retry a lease after explicit stop/restart.
- Progress exposes immutable total, defaults to a 20-cell block bar, accepts width 5–40 and ASCII style, uses floor fill, rejects non-positive increments, and completes to 100% on success.
- The package is ESM-only, supports Node 22, Node 24, and Node 26, and has zero runtime, optional, and peer dependencies.
- Explicit streams are application-owned. Spinlog never patches global output, never manages stdin, installs no process signal or exit listener, and never terminates the host process.
- User text is sanitized only at the render boundary, except caller-defined frames that are sanitized and frozen at definition time. Synchronous cosmetic failures remain target-local; backpressure coalesces cosmetic frames without an unbounded queue, and permanent flushes wait for write callbacks.
- `dist/index.js` may not exceed 10,240 bytes after gzip level 9; a single style import remains limited to 768 gzip bytes.

## Size budget decision

The 10,240-byte ceiling is a versioned product constraint, not a checker bypass. Target-local lease coordination, grapheme-aware width and conservative height safety, custom frame validation, groups, progress, bounded backpressure handling, and the explicit flush boundary must fit within it. Every expansion requires a contract revision, fresh package evidence, and release review.

## Explicit non-goals

- No truecolor, themes, ETA/rate, prompt, structured task-log, global-write-interception, or stdin-management API.
- No CommonJS or browser-first runtime.
- No publication until the blocked 0.2.0 `next` release policy is replaced by reviewed evidence.

## Definition of done

```bash
npm run check:phase-map
npm run check:phase0
```

The Phase 0 command performs mutation-tested structural validation. It rejects API drift, invalid stream policy, incomplete transitions, non-idempotent settlement, unsafe target ownership, missing deferred rationale, repository mismatch, dependency drift, and size-contract changes.
