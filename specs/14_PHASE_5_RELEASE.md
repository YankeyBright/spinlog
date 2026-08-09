# Phase 5: Trusted Release

## Release Preconditions

Before the first publication:

1. Protect `main` and version tags. Require review for the GitHub `release` environment.
2. Configure npm Trusted Publishing for the exact `spinlog/spinlog` repository and `release.yml` workflow, allowing `npm publish`.
3. Remove or revoke npm publish tokens. The release workflow uses OIDC and must not set `NPM_TOKEN` or `NODE_AUTH_TOKEN`.
4. Confirm the workflow runs on a GitHub-hosted runner with Node 24 and npm >=11.5.1.

## Tag-Driven Release Protocol

1. Set the intended semantic version in `package.json` and update the lockfile.
2. Pass the Node 18, 20, 22, and 24 quality matrix and the Node 24 supply-chain job.
3. Create a protected tag named exactly `v<package-version>`.
4. The release workflow performs the following in order:

```text
npm ci --ignore-scripts
-> verify the tag/version match
-> npm run verify:release
-> npm audit --audit-level=low
-> npm publish --provenance
-> create the GitHub Release and attach sbom.json
```

The workflow validates the release tag before publish, fails dependency audit findings at low severity or higher, and only then publishes with npm provenance.

## Post-Publish Verification

```bash
npm audit signatures
npm view spinlog@$(npm pkg get version --json | tr -d '"') --json
npm view spinlog@$(npm pkg get version --json | tr -d '"') dist.attestations --json
```

Confirm that the npm package contains `sbom.json`, the GitHub Release contains the same SBOM asset, and npm reports provenance for the published version.

## Security Response

`SECURITY.md` defines the project's private reporting channel and five-business-day acknowledgement target. Incident-specific remediation, disclosure, and root-cause communications are determined after triage; this document does not promise a fixed public disclosure timeline.

## Definition Of Done

A release is complete only when the package version and tag match, npm provenance is present, `sbom.json` is attached to the GitHub Release, and all repository invariant gates have passed.
