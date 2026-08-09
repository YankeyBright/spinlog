# Project Manifest: spinlog

**One-liner:** A zero-runtime-dependency, ESM-only terminal color and spinner primitive capped at 1,228 gzip bytes.

## Target Users

Node.js CLI developers and security-conscious teams that need terminal feedback without adding a consumer runtime dependency tree.

## Hard Constraints

1. **Zero Runtime Dependencies:** `dependencies`, `optionalDependencies`, and `peerDependencies` remain empty.
2. **No Lifecycle Scripts:** The package declares no install, publish, prepare, or pack lifecycle hook.
3. **ESM Only:** `type: module` and an import-only export map; no CommonJS artifact.
4. **Exact Size Budget:** `dist/index.js` is at most 1,228 bytes after gzip level 9.
5. **Supported Runtime:** Node.js 22 and 24 LTS (`^22.0.0 || ^24.0.0`).
6. **Build Shape:** tsup emits minified ESM JavaScript and TypeScript emits declarations directly; no source maps.
7. **Stream Discipline:** Style helpers are pure; spinner-owned output uses only stderr and the package never writes stdout.
8. **Host Ownership:** The library installs no process-lifecycle listener and never terminates its host process.
9. **Supply Chain:** Releases use GitHub OIDC trusted publishing and include a validated runtime-only CycloneDX SBOM.

## v1 Boundary

The exact surface and behavior are frozen in `specs/v1-public-api.d.ts` and `specs/v1-behavior.json`. They cover ANSI-16 styles, one spinner lifecycle, four mutable fields, and promise wrapping. Phase 2 may implement no additional export.

Task groups, progress bars, prompts, intro/outro helpers, structured logging, custom streams and animations, concurrent spinners, and advanced colors are deferred with rationale in `specs/16_POST_MVP_FEATURES.md`.

## Security Position

Zero runtime dependencies remove a specific consumer-side transitive dependency class. They do not remove source, build-tool, maintainer-account, CI, or registry risk. Package allowlisting, exact development pins, dependency audit, provenance, and SBOM checks address those separate surfaces without claiming certification.
