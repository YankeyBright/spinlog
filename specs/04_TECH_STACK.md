# Toolchain Specification

## Language And Runtime

- Runtime support: Node.js 22 and 24 LTS.
- TypeScript: exact pin `7.0.2`.
- Node declarations: direct exact pin `@types/node@22.20.1`.
- Compiler: `target: "ES2023"`, `lib: ["ES2023"]`, `module: "Node20"`, `moduleResolution: "Node16"`, and `types: ["node"]`.
- Strict checking, declaration output, linked JavaScript source maps, no declaration maps, and no skipped library checks.

`module: "Node20"` is the latest fixed Node module mode in the selected compiler. It avoids floating NodeNext semantics while matching modern ESM behavior on the supported runtimes.

## Build

- Direct esbuild `0.28.2` emits minified, tree-shaken ESM JavaScript for `node22.13`.
- Root and style-only entrypoints receive linked source maps with embedded source content for production diagnostics.
- `tsc --emitDeclarationOnly` emits declarations after the JavaScript build; a narrow pruner keeps only the two public declarations.
- Direct TypeScript emission avoids declaration-bundling plugins and their compiler-version coupling.
- `dist` contains exactly two ESM files, two declarations, and two linked source maps.

## Test And Quality

- Vitest `4.1.10` with Vite `8.2.1` and the V8 provider.
- Explicit `coverage.include` collects every source file; the removed `coverage.all` option is not used.
- 100% statements, branches, functions, and lines globally and per source file.
- Phase 0 policy tests mutate the machine contract and prove that drift is rejected.
- Phase 2 behavior tests use fake timers and controlled stderr writes without network access.
- Phase 2 uses Node's built-in `styleText` and `stripVTControlCharacters` for stable SGR composition and VT removal without adding a runtime dependency.
- The TypeScript CLI compiles both frozen declarations and the emitted consumer surface. Pinned Biome canonicalizes already-valid declarations for exact parity because TypeScript 7's public compiler API is not ready.
- publint and Are The Types Wrong validate the packed manifest and ESM-only resolution profiles.
- A clean packed-consumer test covers package-name imports, Node16/NodeNext/Bundler resolution, stderr behavior, and unreferenced timer exit.
- An in-memory esbuild proof enforces the style-only tree-shaking budget.
- Size Limit `13.0.3` independently checks the gzip byte budget with Node built-ins explicitly externalized.
- Biome `2.5.7` owns formatting and linting.

## Security Tooling

- All direct development dependencies are exact-pinned and locked.
- GitHub Actions use immutable commit SHAs, minimal permissions, and no persisted checkout credentials.
- Phase 5 npm publishing will use OIDC without a long-lived publish token. No current workflow can publish.
- The npm CLI's native SBOM command plus a checked-in deterministic validator generates a reproducible runtime-only CycloneDX 1.5 document.
- esbuild is a direct exact pin at `0.28.2`; tsup and package overrides are prohibited.
- The Phase 1 policy rejects every esbuild resolution in the affected `>=0.27.3 <0.28.1` range.

The runtime package still has no dependency, optional-dependency, or peer-dependency entries. Development tooling is not represented as consumer runtime software.
