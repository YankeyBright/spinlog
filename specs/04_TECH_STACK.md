# Toolchain Specification

## Language And Runtime

- Runtime support: Node.js 22 and 24 LTS.
- TypeScript: exact pin `7.0.2`.
- Node declarations: direct exact pin `@types/node@22.20.1`.
- Compiler: `target: "ES2023"`, `lib: ["ES2023"]`, `module: "Node20"`, `moduleResolution: "Node16"`, and `types: ["node"]`.
- Strict checking, declaration output, no source maps, no declaration maps, and no skipped library checks.

`module: "Node20"` is the latest fixed Node module mode in the selected compiler. It avoids floating NodeNext semantics while matching modern ESM behavior on the supported runtimes.

## Build

- tsup `8.5.1` emits minified, tree-shaken ESM JavaScript only with `target: "node22"` and `dts: false`.
- `tsc --emitDeclarationOnly` emits `dist/index.d.ts` after the JavaScript build.
- Direct TypeScript emission avoids tsup's declaration-bundling plugin path.
- `dist` contains only `index.js` and `index.d.ts`.

## Test And Quality

- Vitest `4.1.10` with Vite `8.2.1` and the V8 provider.
- Explicit `coverage.include` collects every source file; the removed `coverage.all` option is not used.
- 100% statements, branches, functions, and lines globally and per source file.
- Phase 0 policy tests mutate the machine contract and prove that drift is rejected.
- Phase 2 behavior tests use fake timers and controlled stderr writes without network access.
- Size Limit `13.0.3` independently checks the byte budget.
- Biome `2.5.7` owns formatting and linting.

## Security Tooling

- All direct development dependencies are exact-pinned and locked.
- GitHub Actions use immutable commit SHAs, minimal permissions, and no persisted checkout credentials.
- npm publishing uses OIDC without a long-lived publish token.
- The npm CLI's native SBOM command plus a checked-in deterministic validator generates a reproducible runtime-only CycloneDX 1.5 document.
- The tsup-scoped esbuild `0.28.1` override remains until upstream declares a compatible patched range; Phase 1 validates the manifest and lockfile.

The runtime package still has no dependency, optional-dependency, or peer-dependency entries. Development tooling is not represented as consumer runtime software.
