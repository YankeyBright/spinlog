---
locked: true
---
# Definition of Done

A PR/release is DONE only if all invariant gates pass with exact commands. **Manual review is NEVER required** unless a new file in `.github/workflows/` is not pinned to a SHA, or there is new use of `fs`, `child_process`, or network APIs.

## Quality Gate (Node >=18)
```bash
npm ci --ignore-scripts
npm run check:phase-map
npm run check:phase0
npm run check:phase1
```

## Supply-Chain Gate (Node >=20.18.0; release uses Node 24)
```bash
npm run check:phases
npm audit --audit-level=low
```

### Gate 1: Zero Dependencies
```bash
jq -e 'if ((.dependencies // {} | length) > 0) or ((.optionalDependencies // {} | length) > 0) or ((.peerDependencies // {} | length) > 0) then error("fail") else empty end' package.json
test $(npm ls --omit=dev --depth=0 --json | jq '.dependencies // {} | length') -eq 0
```

### Gate 2: ESM / Node >=18
```bash
jq -e '.type == "module"' package.json
jq -e '.engines.node | test(">=.*18")' package.json
! grep -q "module\.exports" dist/index.js
node --input-type=module -e "import('file://$(pwd)/dist/index.js')"
```

### Gate 3: Size <1228 B gzipped
```bash
npm run size
npm run size:limit
```

### Gate 4: Trusted Publishing Config
```bash
grep -q "id-token: write" .github/workflows/release.yml
grep -q "node-version: '24.x'" .github/workflows/release.yml
! grep -q "NPM_TOKEN\\|NODE_AUTH_TOKEN" .github/workflows/release.yml
grep -q "\-\-provenance" .github/workflows/release.yml
```

### Gate 5: SBOM Valid
```bash
npm run sbom
npm run sbom:check
jq -e '.bomFormat == "CycloneDX" and .specVersion == "1.5"' sbom.json
jq -e '(.components // [] | length == 0)' sbom.json
jq -e '.metadata.component.name == "spinlog" and .metadata.component.type == "library"' sbom.json
```

### Gate 6: No Lifecycle Scripts
```bash
npm run policy:check
```

### Gate 7: Ordered Phase Compliance
```bash
npm run check:phases
```

## Additional Testing Gates (from Phase 2)
```bash
npm run test
npm run test:coverage
```

Phase 2 is not complete until its behavior suite explicitly proves stderr-only cosmetic output, cursor restoration, non-TTY degradation, and timer and signal cleanup.

## Release Done Criteria
- [ ] All applicable invariant gates pass in CI
- [ ] `npm audit signatures` passes after publish
- [ ] `sbom.json` attached to GitHub Release
- [ ] Provenance badge visible on npmjs.com
- [ ] Size badge matches `$(gzip -c -9 dist/index.js | wc -c)` B
