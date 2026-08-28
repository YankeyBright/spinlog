# Project Manifest: spinlog

**One-liner:** A zero-runtime-dependency, ESM-only terminal feedback library capped at 10,496 gzip bytes.

## Target Users

Node.js CLI developers and security-conscious teams that need terminal feedback without adding a consumer runtime dependency tree.

## Hard Constraints

1. **Zero Runtime Dependencies:** `dependencies`, `optionalDependencies`, and `peerDependencies` remain empty.
2. **No Lifecycle Scripts:** The package declares no install, publish, prepare, or pack lifecycle hook.
3. **ESM Only:** `type: module` and an import-only export map; no CommonJS artifact.
4. **Exact Size Budget:** `dist/index.js` is at most 10,496 bytes after gzip level 9.
5. **Supported Runtime:** Node.js 22, 24, and 26 (`^22.13.0 || ^24.0.0 || ^26.0.0`).
6. **Build Shape:** Direct esbuild emits two minified ESM entrypoints with linked source maps; TypeScript emits declarations directly.
7. **Stream Discipline:** Style helpers are side-effect-free and stream-free; render surfaces default to stderr, accept explicit writable targets, never patch global writes, and never manage stdin.
8. **Host Ownership:** The library installs no process-lifecycle listener and never terminates its host process.
9. **Supply Chain:** Releases use GitHub OIDC trusted publishing and include a validated runtime-only CycloneDX SBOM.

## Pre-1.0 boundary

The exact surface and behavior are frozen in `specs/v1-public-api.d.ts`, `specs/v1-styles-api.d.ts`, and `specs/v1-behavior.json`. They cover ANSI-16 styles, explicit writable targets, one interactive lease per stream, custom frames, task groups with height safety, determinate progress, four mutable fields, static modes, terminal overrides, instance logging, explicit disposal, promise settlement text, and coordinated intro/outro flow messages. Phase 2 may implement no additional export.

Prompts, structured logging, global write interception, stdin ownership, and advanced colors are deferred with rationale in `specs/16_POST_MVP_FEATURES.md`.

## Security Position

Zero runtime dependencies remove a specific consumer-side transitive dependency class. They do not remove source, build-tool, maintainer-account, CI, or registry risk. Package allowlisting, exact development pins, dependency audit, provenance, and SBOM checks address those separate surfaces without claiming certification.
