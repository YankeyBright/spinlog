# Security & Compliance Requirements

## NIST SSDF Mapping

| Control | Implementation |
|---|---|
| PO.1, PO.2 (Prepare Org) | Branch protection, two required reviewers, and `SECURITY.md` establish release ownership and disclosure expectations. |
| PS.3 (Protect Software) | Generate and validate a CycloneDX v1.5 SBOM in the Node 24 supply-chain job, then publish it with the tarball and GitHub Release. |
| PW.4 (Well-Secured Reuse) | Runtime, optional, and peer dependency maps are empty. The generated runtime SBOM proves `components: []`. |
| PW.5, PW.8 (Produce Secure) | Vitest with fake timers and mocked streams covers runtime behavior; CI runs typecheck, lint, test, package, and supply-chain checks. |
| RV.1 (Respond to Vulnerabilities) | `SECURITY.md` defines a private reporting channel and acknowledgement target. |

## Provenance And Trusted Publishing

- Publish only from the GitHub-hosted release workflow.
- Grant `id-token: write` and use `npm publish --provenance`.
- Use Node 24 and npm >=11.5.1. npm trusted publishing requires Node >=22.14.0 and npm >=11.5.1.
- Do not use `NPM_TOKEN` or `NODE_AUTH_TOKEN` to publish.
- Protect release tags and the GitHub `release` environment before publishing.
- Verify the tag matches `package.json` before publication.

Before the first release, configure the npm Trusted Publisher with the exact GitHub owner, repository, workflow filename `release.yml`, and `release` environment, then allow the `npm publish` action. npm validates those values at publish time, not when the configuration is saved.

OIDC provenance is an npm attestation mechanism. It strengthens build-origin evidence but must not be represented as a standalone SLSA Level 3 certification.

## CycloneDX SBOM v1.5

Generate and validate the runtime SBOM with Node >=20.18.0:

```bash
npm run sbom
npm run sbom:check
```

The SBOM command omits development, optional, and peer dependency classes. The resulting document must have the following properties:

- `bomFormat: CycloneDX`
- `specVersion: 1.5`
- `metadata.component.name: spinlog`
- `metadata.component.type: library`
- `components: []`

Attach `sbom.json` to the npm tarball and the GitHub Release. The Node 24 supply-chain job verifies the file before publication.

## International Considerations

- `README.md` documents the zero-runtime-dependency policy, absence of package lifecycle scripts, OIDC provenance, and audit commands.
- Run `npm audit signatures` and inspect the npm provenance record after publication.
- Keep the repository's security contact and disclosure target current.

## e18e Alignment

- Position the package as a modern, dependency-free alternative for its defined terminal-output scope.
- Do not publish capability or compatibility claims before the corresponding runtime behavior and tests exist.
