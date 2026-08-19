# Phase 4: Documentation and Migration

## Goal

Publish tested, source-controlled guidance for the frozen v1 behavior without expanding the npm payload or making Phase 5 release claims.

## Public Documentation

- `README.md` documents the callable factory, exact mutable fields, lifecycle and idempotency, promise semantics, intro/outro messages, styles, stderr policy, environment precedence, sanitization, process ownership, Node support, package evidence, and verification commands.
- Canonical runnable files under `examples/` are the source of every README code block. `npm run docs:update` synchronizes them; `npm run docs:check` fails on snippet drift, API claims, measured gzip size, SBOM claims, unsupported Node ranges, or broken relative links.
- The measured root artifact size is derived from `dist/index.js` with gzip level 9. Documentation may not substitute the 2,560-byte ceiling for the measured value.
- Public wording must state that Phase 5 provenance, SLSA, publication, and post-publication verification evidence does not yet exist.

## Migration

- `MIGRATION.md` states that spinlog is not API-compatible with Chalk, Ora, or Clack.
- Chalk guidance maps only named ANSI-16 functions and explicit function composition.
- Ora guidance maps only the frozen single-spinner lifecycle and mutable fields.
- Clack guidance maps only independent intro/outro flow messages and tells applications to settle active spinners first.
- Unsupported chaining, advanced colors, custom streams, custom animation data, simultaneous spinners, prompts, task groups, progress bars, cancellation orchestration, and CommonJS remain explicit.
- Migration examples are canonical files under `examples/`; no codemod or runtime dependency is introduced.

## Packed Evidence

`npm run test:examples` builds an npm tarball, installs it with lifecycle scripts disabled and development dependencies omitted, copies every canonical example into the consumer, and executes each example through public package entrypoints. Any nonzero exit or stdout output fails the gate.

`README.md`, `MIGRATION.md`, and `examples/` are tracked public source. `MIGRATION.md` and `examples/` remain excluded from the exact eleven-file npm payload.

## Definition Of Done

```bash
npm run docs:check
npm run test:examples
npm run check:phase4
npm run check:phases
```

Phase 4 is locally implemented when its gate passes. Project-wide completion still requires the reviewed five-run Node 24 benchmark baseline, the Node 22/24/26 remote matrices, and a green final Phase 0-through-Phase 4 aggregate. No production-ready or release claim is permitted before Phase 5.
