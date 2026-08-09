# spinlog

A sub-1.2kB, zero-dependency, ESM-only unified primitive that replaces chalk + ora.

## Status

Phase 0 freezes the product contract. Phase 1 establishes the secure package shell. Both foundation phases are complete; the v1 runtime API begins in Phase 2 and is not implemented yet.

## Planned Features (v1)

- **Colors**: Direct terminal styling without the weight of chalk.
- **Spinner**: Built-in animation loop designed for modern Node.js.
- **State Transitions**: Easy toggling between `succeed`, `fail`, `warn`, and `info` states.
- **Live Mutation**: Change text, colors, prefixes, and suffixes on the fly.
- **Promise Wrapper**: Simple `.promise(...)` utility.

*Note: Phase 0 and Phase 1 contain no runtime functionality. See the [canonical phase map](docs/phase-map.md) for the implementation sequence.*

## Why spinlog?

1. **Zero Dependencies**: Absolutely no `dependencies` or `optionalDependencies`.
2. **ESM-Only**: Targets Node >=18. No legacy CommonJS bloat.
3. **Tiny**: The budget is strict: sub-1.2kB minified and gzipped.
4. **Stderr-first**: Stream discipline ensures cosmetic output never pollutes `stdout`.
5. **Secure Supply Chain**: The published package has no lifecycle scripts. Releases use GitHub OIDC trusted publishing and include a CycloneDX SBOM.

## Verification

Run the Phase 0 contract and Phase 1 package-shell checks with Node 18 or newer:

```bash
npm ci --ignore-scripts
npm run check:phase-map
npm run check:phase0
npm run check:phase1
```

Run the complete ordered phase gate with Node 20.18 or newer. The release workflow uses Node 24.

```bash
npm run check:phases
npm audit --audit-level=low
```

The final successful line from `check:phases` is a machine-readable JSON summary. See [the phase checker contract](docs/phase-checker.md) for each check's exact ownership and prerequisites.

The generated `sbom.json` is a CycloneDX v1.5 library SBOM. Its `components` list is intentionally empty because `spinlog` has no runtime, optional, or peer dependencies.

After publication, verify registry signatures and provenance:

```bash
npm audit signatures
npm view spinlog@$(npm pkg get version --json | tr -d '"') --json
```

## License

MIT
