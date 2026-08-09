# Phase 1: Package Scaffolding

## Goal

Create a production-ready TypeScript package shell around the frozen Phase 0 contract. Phase 1 proves build, test, package, size, and release controls without implementing the v1 runtime API.

## Package Manifest

- ESM-only package with `type: "module"`, `sideEffects: false`, and an import-only export map.
- Node runtime floor of `>=18`.
- Publish allowlist limited to `dist`, `README.md`, `LICENSE`, `SECURITY.md`, and `sbom.json`.
- No runtime, optional, or peer dependencies.
- No npm lifecycle scripts.
- Development dependencies are exact-pinned and limited to build, test, formatting, size, SBOM, and release verification.

## TypeScript and Build Contract

- TypeScript is pinned to `7.0.2`.
- `target` is `ES2022`, `module` is `Node18`, and `moduleResolution` is `Node16`.
- `src` is the source root and `dist` is the output directory.
- Strict checking and declaration emission are enabled; source maps and declaration maps are disabled.
- tsup builds minified, tree-shaken ESM JavaScript only.
- `tsc --emitDeclarationOnly` produces declarations after the JavaScript build.
- No CommonJS artifact or source map may be generated.

## Quality and Release Preparation

- Vitest runs in Node with V8 coverage at 100% globally and per source file.
- Biome formatting and linting are enabled.
- The gzip size gate fails above 1,228 bytes.
- The package dry-run must contain only allowlisted files.
- CI verifies Node 18, 20, 22, and 24.
- Release preparation uses GitHub OIDC, pinned action SHAs, a runtime-only CycloneDX 1.5 SBOM, and no long-lived npm token.
- The Phase 1 gate rejects esbuild versions affected by GHSA-g7r4-m6w7-qqqr and requires an explicit review when tsup's declared esbuild range changes.

## Source and Test Shell

- `src/index.ts` remains an inert entry point until Phase 2.
- `test/` contains only package-shell and verification-control tests.
- Runtime implementation files are not required by the Phase 1 gate.

## Definition of Done

```bash
npm run check:phase-map
npm run check:phase1
npm run check:phase1:release
```

All commands must exit successfully. The package must remain importable as ESM, emit valid declarations, stay within the size budget, and preserve the seven-file tarball allowlist.
