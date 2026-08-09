# Invariants

Every MUST/NEVER rule governing the `spinlog` codebase. These are absolute constraints.

1. **The package MUST maintain exactly zero runtime, optional, and peer dependencies.**
   - *Why:* To eliminate all transitive supply chain risk (NIST SSDF PW.4).
   - *Proof Command:* 
     ```bash
     jq -e 'if ((.dependencies // {} | length) > 0) or ((.optionalDependencies // {} | length) > 0) or ((.peerDependencies // {} | length) > 0) then error("FAIL") else empty end' package.json
     test $(npm ls --omit=dev --depth=0 --json | jq '.dependencies // {} | length') -eq 0
     ```

2. **The package MUST be built as ESM-only, targeting Node >= 18.**
   - *Why:* To match modern JS ecosystem standards (e18e initiative) without carrying legacy CJS bloat.
   - *Proof Command:*
     ```bash
     jq -e '.type == "module"' package.json
     jq -e '.engines.node | test(">=.*18")' package.json
     ! grep -q "module\.exports" dist/index.js
     node --input-type=module -e "import('file://$(pwd)/dist/index.js')"
     ```

3. **The final minified + gzipped size of `dist/index.js` MUST NEVER exceed 1,228 bytes.**
   - *Why:* To fulfill the core value proposition of being the lightest possible CLI visual primitive.
   - *Proof Command:*
     ```bash
     npm run size
     npm run size:limit
     ```

4. **The release pipeline MUST use GitHub OIDC to generate Sigstore provenance attestations.**
   - *Why:* To neutralize stolen npm token attacks and create verifiable build-origin evidence.
   - *Proof Command (CI config check & Post-publish check):*
     ```bash
     grep -q "id-token: write" .github/workflows/release.yml
     grep -q "node-version: '24.x'" .github/workflows/release.yml
     ! grep -q "NPM_TOKEN\\|NODE_AUTH_TOKEN" .github/workflows/release.yml
     grep -q "\-\-provenance" .github/workflows/release.yml
     npm audit signatures
     npm view spinlog@$(jq -r .version package.json) --json | jq -e '.dist.attestations != null'
     ```

5. **Every release candidate MUST generate a valid CycloneDX v1.5 SBOM JSON file.**
   - *Why:* To comply with EO 14028 mandates and prove the zero-dependency pedigree.
   - *Proof Command (Node >=20.18.0):*
     ```bash
     npm run sbom
     npm run sbom:check
     test -f sbom.json
     jq -e '.bomFormat=="CycloneDX" and .specVersion=="1.5"' sbom.json
     jq -e '(.components // [] | length == 0)' sbom.json
     jq -e '.metadata.component.name=="spinlog"' sbom.json
     jq -e '.metadata.component.type=="library"' sbom.json
     ```

6. **The library MUST NEVER use npm lifecycle scripts.**
   - *Why:* To prevent arbitrary remote code execution during package installation.
   - *Proof Command:*
     ```bash
     npm run policy:check
     ```

7. **The published package MUST contain only `dist`, `README.md`, `LICENSE`, `SECURITY.md`, and optionally `sbom.json`.**
   - *Why:* To keep the package payload minimal and auditable.
   - *Proof Command:*
     ```bash
     npm run pack:check
     ```

8. **The canonical phase map and Phase 0/1 compliance MUST be verified by ordered, fail-fast, machine-readable package commands.**
   - *Why:* To prevent the product boundary, package shell, runtime phase, and release policy from drifting apart.
   - *Proof Command (Node >=20.18.0):*
     ```bash
     npm run check:phase-map
     npm run check:phases
     ```
   - *Expected final output:*
     ```json
     {"phase0":"pass","phase1":"pass","phase1Release":"pass"}
     ```
   - *Canonical boundary:* Phase 0 locks product policy, Phase 1 establishes the package shell, and Phase 2 is the first runtime implementation and behavior-testing phase.

9. **Every `src/**/*.ts` file MUST achieve 100% V8 coverage for statements, branches, functions, and lines, both globally and per file.**
   - *Why:* A compact terminal library can maintain complete behavioral test coverage without allowing aggregate metrics to conceal an untested module.
   - *Proof Command:*
     ```bash
     npm run test:coverage
     ```
   - *Enforcement:* Coverage includes all source files, preserves Vitest's default exclusions, disables threshold auto-updates, and rejects standard V8, Istanbul, and C8 coverage-suppression directives in `src`.

10. **The build toolchain MUST NOT resolve an esbuild version affected by GHSA-g7r4-m6w7-qqqr.**
   - *Why:* Build-only dependencies remain part of the trusted release environment even though they are excluded from the published runtime graph.
   - *Proof Command:*
     ```bash
     npm run check:phase1
     npm audit --audit-level=low
     ```
   - *Enforcement:* While tsup declares `esbuild: "^0.27.0"`, the package applies a scoped `0.28.1` override. The Phase 1 checker validates the manifest, lockfile resolution, absence of affected versions, and the upstream range used as the override-retirement signal.
