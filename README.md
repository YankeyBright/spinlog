# spinlog

An ESM-only terminal color and spinner primitive with zero consumer runtime dependencies and an exact 1,228-byte gzip budget.

## Status

Phase 0 freezes the product contract. Phase 1 establishes the secure package shell. Both foundation phases are complete; the v1 runtime API begins in Phase 2 and is not implemented or published yet.

The exact planned API and behavior are frozen in [`specs/v1-public-api.d.ts`](specs/v1-public-api.d.ts) and [`specs/v1-behavior.json`](specs/v1-behavior.json). Phase 0 and Phase 1 contain no runtime feature implementation.

## Frozen v1 Boundary

- ANSI-16 foreground/background styles and six modifiers.
- One spinner with explicit lifecycle transitions.
- Live mutation of text, color, prefix, and suffix.
- Promise and promise-factory wrapping.
- Pure style helpers and stderr-only spinner output.

Task groups, progress bars, prompts, intro/outro helpers, structured logs, custom streams and animation data, concurrent spinners, and advanced color modes are deferred.

## Package Controls

- No runtime, optional, or peer dependencies.
- No npm lifecycle scripts.
- ESM-only support for Node.js 22 and 24 LTS.
- `dist/index.js` limited to 1,228 bytes using gzip level 9.
- Import-only exports and a seven-file publication allowlist.
- Runtime-only CycloneDX 1.5 SBOM.
- OIDC trusted publishing from the public [`YankeyBright/spinlog`](https://github.com/YankeyBright/spinlog) repository.

These controls reduce specific dependency and publication risks; they are not a security certification or a claim of zero risk.

## Verification

Use a supported Node 22 or Node 24 release:

```bash
npm ci --ignore-scripts
npm run check:phase0
npm run check:phase1
npm run check:phases
npm audit --audit-level=low
```

The final successful aggregate line is:

```json
{"phase0":"pass","phase1":"pass","phase1Release":"pass"}
```

After a real publication, verify registry signatures and inspect the version's provenance attestations with `npm audit signatures` and `npm view spinlog@<version> --json`.

## License

MIT
