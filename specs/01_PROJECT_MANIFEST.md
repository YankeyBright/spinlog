# Project Manifest: spinlog

**One-liner:** A sub-1.2kB, zero-runtime-dependency, ESM-only terminal primitive for colors and spinner state transitions on Node.js.

## Target Users

Node.js CLI developers and security-conscious organizations that need polished terminal feedback without adding a runtime dependency tree.

## Hard Constraints

1. **Zero Runtime Surface:** `dependencies`, `optionalDependencies`, and `peerDependencies` are empty.
2. **No Package Lifecycle Scripts:** The published package declares no install, publish, prepare, or pack lifecycle scripts.
3. **ESM Only:** `type: module` with an import-only public export map. No CommonJS output.
4. **Size Budget:** `dist/index.js` is at most 1,228 bytes after gzip compression.
5. **Node >=18:** The runtime is supported and verified from Node 18 upward.
6. **Build Shape:** `tsup` produces minified ESM declarations without source maps; `sideEffects` is `false`.
7. **Stream Discipline:** Cosmetic colors, spinner frames, and terminal state output use `stderr` only.
8. **Supply Chain:** Release publishing uses GitHub OIDC provenance and includes a runtime-only CycloneDX SBOM.

## v1 API Boundary

- Color functions and named color exports.
- A spinner with `start`, `stop`, `succeed`, `fail`, `warn`, and `info` transitions.
- Live mutation of `text`, `color`, `prefix`, and `suffix`.
- `spinlog.promise(...)`.

## Deferred Beyond v1

Task groups, progress bars, prompts, intro/outro helpers, and structured JSON logging are explicitly deferred. See `docs/post-mvp.md` for the rationale.

## Value Proposition

- Replaces the colors-and-spinner portion of a fragmented CLI stack without runtime dependencies.
- Keeps machine-readable `stdout` clean by default.
- Provides verifiable package contents, SBOM, and npm provenance evidence for audit workflows.
- Aligns with the dependency-reduction goals of ecosystem cleanup efforts without making unsupported compliance-certification claims.
