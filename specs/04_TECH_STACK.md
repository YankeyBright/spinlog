# Programming Tools To Use

**Language & Runtime:**
- TypeScript -> ESM-only JS
- Target: Node.js >= 18
- TypeScript: exact pin `7.0.2`
- Config: `strict: true`, `module: "Node18"`, `moduleResolution: "Node16"`, `target: "ES2022"`
- Declarations: direct `tsc --emitDeclarationOnly` after the JavaScript build

**Bundler:**
- `tsup` configured:
  - `format: ['esm']`
  - `minify: true`
  - `sourcemap: false`
  - `dts: false`
  - treeshake + `sideEffects: false` in package.json

tsup owns JavaScript bundling only. Direct TypeScript declaration emit avoids coupling the package build to tsup's declaration-bundling plugin while preserving `dist/index.d.ts`.

**Testing & Quality:**
- `vitest` with:
  - fake timers for 80ms interval
  - stream mocking (mock process.stderr.write)
  - ESM-native execution
  - 100% coverage threshold enforced
- `biome` for zero-configuration, lightning-fast formatting and linting (replaces ESLint/Prettier to align with zero runtime/minimal tooling ethos)

**Security & Compliance:**
- GitHub Actions with OIDC -> Sigstore provenance
- Trusted publishing (no long-lived NPM_TOKEN)
- Branch protection: require multi-party review
- Pin all GitHub Actions to SHA hash, not @v4 tag
- Scope the tsup esbuild override to patched `0.28.1` until tsup declares a compatible patched range; validate both the override and lockfile in the Phase 1 gate

**Inventory Tooling:**
- CycloneDX CLI: `@cyclonedx/cyclonedx-npm`
- Generate and validate a reproducible, runtime-only CycloneDX JSON v1.5 SBOM in the supply-chain and release gates
- Document zero-dependency pedigree

**Package.json must include:**
```json
{
  "type": "module",
  "sideEffects": false,
  "files": ["dist", "README.md", "LICENSE", "SECURITY.md", "sbom.json"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```
And NO `dependencies`, NO `optionalDependencies`, NO `scripts` with pre/post install.
