# Phase 1: Package Scaffolding

## Goal

Create a production package shell around the frozen Phase 0 contract. Phase 1 proves build, test, package, size, and release controls without implementing v1 runtime behavior.

## Package Manifest

- ESM-only with `type: "module"`, `sideEffects: false`, and an import-only export map.
- Runtime engines `^22.0.0 || ^24.0.0` and public repository `YankeyBright/spinlog`.
- Publish allowlist limited to `dist`, `README.md`, `LICENSE`, `SECURITY.md`, and `sbom.json`.
- No runtime, optional, or peer dependencies and no npm lifecycle scripts.
- Direct development dependencies are exact-pinned and lockfile-resolved.

## TypeScript And Build

- TypeScript `7.0.2` with direct `@types/node@22.20.1`.
- `target: "ES2023"`, `lib: ["ES2023"]`, `module: "Node20"`, and `moduleResolution: "Node16"`.
- Strict checking and declaration emission; no skipped library checks or map output.
- tsup emits minified, tree-shaken ESM JavaScript with `target: "node22"` and no declarations.
- `tsc --emitDeclarationOnly` subsequently emits `dist/index.d.ts`.
- Dist contains exactly ESM JavaScript and declarations.

## Quality And Release Preparation

- Vitest enforces 100% V8 coverage globally and per source file.
- The Phase 0 policy suite proves the contract validator rejects known drift cases.
- Biome formatting and linting are enabled.
- The exact gzip gate rejects artifacts above 1,228 bytes.
- Package dry-run validation enforces the approved seven-file tarball.
- Required CI runs on Node 22 and Node 24.
- Release preparation uses immutable action commits, disabled persisted credentials, GitHub OIDC, a runtime-only CycloneDX 1.5 SBOM, and no long-lived npm token.
- The Phase 1 gate retains and validates the patched esbuild override until its explicit retirement condition is met.

## Source Boundary

`src/index.ts` remains inert through Phase 1. The contract declaration under `specs` is not the emitted package declaration and does not claim implementation. Runtime modules and behavior tests begin in Phase 2.

## Definition Of Done

```bash
npm run check:phase0
npm run check:phase1
npm run check:phase1:release
```

All commands must pass before Phase 1 is marked complete.
