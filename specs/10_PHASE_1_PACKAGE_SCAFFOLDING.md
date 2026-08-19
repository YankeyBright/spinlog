# Phase 1: Package Scaffolding

## Goal

Create a production package shell around the frozen Phase 0 contract. Phase 1 proves build, test, package, size, and release controls without implementing v1 runtime behavior.

## Package Manifest

- ESM-only with `type: "module"`, `sideEffects: false`, and an import-only export map.
- Runtime engines `^22.13.0 || ^24.0.0 || ^26.0.0` and public repository `YankeyBright/spinlog`.
- Publish allowlist limited to `dist`, `README.md`, `LICENSE`, `SECURITY.md`, and `sbom.json`.
- No runtime, optional, or peer dependencies and no npm lifecycle scripts.
- Direct development dependencies are exact-pinned and lockfile-resolved.

## TypeScript And Build

- TypeScript `7.0.2` with direct `@types/node@22.20.1`.
- `target: "ES2023"`, `lib: ["ES2023"]`, `module: "Node20"`, and `moduleResolution: "Node16"`.
- Strict checking with isolated declarations, unchecked-index protection, unused-code checks, declaration emission, and no skipped library checks.
- Direct exact-pinned esbuild emits minified, tree-shaken ESM JavaScript with `target: "node22.13"` and linked source maps.
- `tsc --emitDeclarationOnly` subsequently emits public declarations without declaration maps.
- Dist contains exactly the root/style ESM entrypoints, their declarations, and their linked source maps.

## Quality And Release Preparation

- Vitest enforces 100% V8 coverage globally and per source file.
- The Phase 0 policy suite proves the contract validator rejects known drift cases.
- Biome formatting and linting are enabled.
- The exact gzip gate rejects artifacts above 2,560 bytes. Size Limit independently measures gzip output while externalizing only the Node `util` and `process` built-ins used by the ESM artifact.
- Package dry-run validation enforces the approved eleven-file tarball.
- publint, Are The Types Wrong, and a clean packed-consumer test validate real package consumption.
- Required CI covers the frozen Node 22, Node 24, and Node 26 matrix, plus Windows and macOS packed-consumer jobs.
- Release readiness uses immutable action commits, disabled persisted credentials, read-only permissions, a runtime-only CycloneDX 1.5 SBOM, and no publication capability before Phase 5.
- Direct esbuild replaced tsup; the obsolete override is prohibited and the lockfile is scanned for affected esbuild versions.

## Source Boundary

At Phase 1 completion, `src/index.ts` remained inert. The contract declaration under `specs` was not the emitted package declaration and did not claim implementation. Runtime modules and behavior tests were subsequently added under Phase 2.

## Definition Of Done

```bash
npm run check:phase0
npm run check:phase1
npm run check:phase1:release
```

All commands must pass before Phase 1 is marked complete.
