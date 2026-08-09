# Phase 3: Benchmarking and SBOM Hardening

## Size Gate (Hard Fail)

The package budget is exactly 1,228 gzipped bytes for `dist/index.js`.

```bash
npm run build
npm run size
npm run size:limit
```

`npm run size` performs the hard cross-platform Node `zlib` check. The `.size-limit.json` policy independently enforces the unambiguous `1228 B` limit across the supported Node matrix.

## Benchmarking

When runtime functionality exists, create `bench/compare.mjs` with a statistically aware benchmark runner. Measure:

- cold import time
- unpacked package size
- minified and gzipped entrypoint size

Benchmark dependencies belong to the development toolchain only and must not enter the published package.

## SBOM Generation

The supply-chain job uses the release baseline, Node 24. The generator delegates inventory extraction to npm's native lockfile-only SBOM command, then removes volatile generation metadata, normalizes the root identity from `package.json` independently of the checkout-directory name, canonicalizes the document, and validates the frozen package identity and empty runtime graph.

```bash
npm run sbom
npm run sbom:check
```

The generated `sbom.json` must be a CycloneDX 1.5 library document for `spinlog` with an empty `components` array. It deliberately excludes development, optional, and peer dependency classes so it represents the published runtime package rather than the build workstation.

## Release Artifacts

`sbom.json` is an allowlisted npm payload file and a GitHub Release asset. The release pipeline runs, in order:

```text
typecheck -> lint -> test -> build -> size -> package policy -> SBOM -> SBOM check -> audit -> publish with provenance -> GitHub Release
```
