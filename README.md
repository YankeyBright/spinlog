# spinlog

An ESM-only terminal color and spinner primitive with zero consumer runtime dependencies and an exact 2,560-byte gzip ceiling.

## Status

Phase 0 freezes the product contract. Phase 1 establishes the secure package shell. As frozen, the v1 runtime API begins in Phase 2; that runtime and its tracked semantic API reports are implemented. Phase 3 hardening is implemented but remains incomplete until CI produces a five-run Node 24 Linux baseline candidate, that artifact is reviewed, and the accepted baseline is committed separately. The package is not production-released, and nothing has been published.

The exact API and behavior are frozen in [`specs/v1-public-api.d.ts`](specs/v1-public-api.d.ts), [`specs/v1-styles-api.d.ts`](specs/v1-styles-api.d.ts), and [`specs/v1-behavior.json`](specs/v1-behavior.json). Phase 0 and Phase 1 introduced no runtime features; the current implementation belongs to Phase 2.

## Frozen v1 Boundary

- ANSI-16 foreground/background styles and six modifiers.
- One spinner with explicit lifecycle transitions.
- Live mutation of text, color, prefix, and suffix.
- Promise and promise-factory wrapping.
- Side-effect-free, stream-free style helpers and stderr-only spinner output.

Task groups, progress bars, prompts, intro/outro helpers, structured logs, custom streams and animation data, concurrent spinners, and advanced color modes are deferred.

## Package Controls

- No runtime, optional, or peer dependencies.
- No npm lifecycle scripts.
- ESM-only support for Node.js `^22.13.0 || ^24.0.0`.
- `dist/index.js` limited to 2,560 bytes using gzip level 9.
- Root and `spinlog/styles` import-only entrypoints with external source maps.
- An exact eleven-file publication allowlist.
- Runtime-only CycloneDX 1.5 SBOM.
- Separate build-tool SBOM, benchmark, reproducibility, and candidate-manifest evidence kept outside the npm package.
- Public source repository: [`YankeyBright/spinlog`](https://github.com/YankeyBright/spinlog).
- A read-only release-readiness workflow with npm OIDC publication deferred until Phase 5.

These controls reduce specific dependency and publication risks; they are not a security certification or a claim of zero risk.

## Verification

Use Node 22.13.0 or later on the Node 22 line, or a supported Node 24 release:

```bash
npm ci --ignore-scripts
npm run check:phase0
npm run check:phase1
npm run check:phase2
npm run check:phase3
npm run check:phases
npm audit --audit-level=low
```

The ordered foundation aggregate covers every implemented phase that does not require remote benchmark evidence:

```json
{"phase0":"pass","phase1":"pass","phase1Release":"pass","phase2":"pass"}
```

`check:phase3` is a separate fail-closed gate. CI collects its five baseline inputs on independent matrix jobs and emits only a reviewable baseline-candidate artifact; CI never overwrites `bench/baseline.json` or compares a candidate against a baseline generated from that same candidate. Before a reviewed Node 24 baseline is committed, `check:phase3` and `verify:candidate` intentionally fail.

After a real publication, verify registry signatures and inspect the version's provenance attestations with `npm audit signatures` and `npm view spinlog@<version> --json`.

## License

MIT
