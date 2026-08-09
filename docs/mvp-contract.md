# spinlog MVP Contract

This document freezes what spinlog v1 is, what it is not, and the rules the codebase must never violate.

## What v1 Is

- **colors**: Output terminal styling.
- **spinner**: Core spinner animation loop.
- **spinner state transitions**: `succeed`, `fail`, `warn`, `info`.
- **live mutation**: Ability to mutate `text`, `color`, `prefix`, `suffix` during the spinner lifecycle.
- **promise wrapper**: `spinlog.promise(...)` helper.
- **stderr-first terminal output**: All cosmetic output and animation frames write exclusively to stderr.
- **zero runtime dependencies**: No dependencies, optional dependencies, or peer dependencies.
- **ESM-only**: Packaged exclusively as ES modules.
- **Node >=18 runtime support**: Targeted and tested against Node.js versions 18 and newer.
- **sub-1.2kB minified + gzip budget**: Guaranteed tiny bundle size.

## CI & Release Scaffolding Contract

- **Foundation phases**: Phase 0 freezes the product contract and Phase 1 establishes CI and publication scaffolding. Neither phase publishes to npm without an explicit version tag (`v*`) or implements the v1 runtime.
- **Runtime-only SBOM**: The generated `sbom.json` represents exclusively the runtime package surface. Dev dependencies are build-time tools and are omitted (`--omit dev --omit optional --omit peer`).
- **Runtime vs Release Toolchain**: `spinlog` runtime supports Node >= 18. The automated release pipeline uses Node 24 because modern NPM trusted publishing OIDC provenance requires updated publish tooling.

## What v1 Is Not

- **task groups**: Not implemented in v1.
- **progress bars**: Not implemented in v1.
- **prompts**: Not implemented in v1.
- **intro/outro helpers**: Not implemented in v1.
- **structured JSON logging**: Not implemented in v1.
- **CommonJS support**: Not provided (ESM only).
- **browser support**: Not supported as a primary runtime.
