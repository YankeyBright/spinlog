# Toolchain Policy

## Compatibility Boundaries

- `spinlog` is a runtime library for Node >=18.
- The cross-platform quality gate runs on Node 18, 20, 22, and 24.
- SBOM generation uses `@cyclonedx/cyclonedx-npm`, which requires Node >=20.18.0. The release and supply-chain jobs therefore run on Node 24.
- npm OIDC trusted publishing requires npm >=11.5.1 and Node >=22.14.0. Node 24 satisfies both requirements.

## Version Policy

All direct development tools are exact-pinned in `package.json` and resolved by `package-lock.json`. This keeps the library's runtime dependency surface at zero while making build, test, size, and release tooling reproducible.

TypeScript is pinned to the stable `7.0.2` release. The compiler executes on Node >=16.20.0, satisfying the Node 18 quality floor, and it satisfies tsup's TypeScript peer range. The published compiler contract is `target: "ES2022"`, `module: "Node18"`, and `moduleResolution: "Node16"`.

`npm run build` executes two explicit stages in order. `build:js` uses tsup only for minified ESM JavaScript with declaration generation disabled. `build:types` invokes `tsc --emitDeclarationOnly`, making TypeScript itself the declaration authority. This design does not execute tsup's `rollup-plugin-dts` path, so declaration correctness no longer depends on the compatibility layer that caused the earlier compiler crash.

Changing the TypeScript pin or module contract requires a lockfile refresh plus successful typecheck, JavaScript build, declaration emission, ESM import, coverage, size, package, SBOM, and release-policy verification.

Vitest is pinned to `3.2.7` because Vitest 4 requires Node >=20, while the package contract requires Node 18 verification. Vite is pinned to the Node-18-compatible 6.x line to prevent its peer range from selecting a Node-20-only release.

Size Limit is pinned to `11.2.0` because later majors raise their Node floor beyond the Node 18 quality matrix. It remains an independent check alongside the hard `zlib` gzip measurement.

`tsup` 8.5.1 declares `esbuild: "^0.27.0"`. [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) affects esbuild versions from `0.27.3` through versions below `0.28.1`; `0.28.1` is the patched release. The package therefore applies a narrow `tsup`-scoped override to `0.28.1`. This is development-tooling containment only and does not enter the published dependency surface or runtime SBOM.

The Phase 1 checker requires the scoped override, verifies the root lockfile resolution is `0.28.1`, and rejects every lockfile esbuild entry in the affected range. It also requires tsup's current `^0.27.0` declaration so an upstream range change fails closed and triggers an explicit retirement review.

Remove the override only when tsup publishes a release whose declared range includes a patched esbuild version, or when tsup is replaced. Either change requires a lockfile refresh, a clean dependency audit, and successful typecheck, build, coverage, size, package, SBOM, and release-policy gates.

## Coverage Policy

Vitest uses the V8 provider to cover every `src/**/*.ts` file. Statements, branches, functions, and lines each require 100% coverage globally and per file. Untested source files remain part of the report, Vitest's default coverage exclusions are preserved, and automatic threshold updates are disabled.

`npm run test` is the fast local suite. `npm run test:coverage` is mandatory in `check:phase1` and `verify`, so CI and release verification enforce the coverage policy. Standard V8, Istanbul, and C8 coverage-suppression directives are prohibited in `src` and checked as part of the Phase 1 gate.

## Install And Release Policy

CI installs with `npm ci --ignore-scripts`. The repository itself has no npm lifecycle scripts, and the flag also prevents third-party install hooks from executing in verification environments.

The release workflow is the only supported publication path. Configure npm Trusted Publishing for `spinlog/spinlog`, `.github/workflows/release.yml`, and the `release` environment; allow `npm publish`, protect release tags, and do not retain npm publish tokens for this package.
