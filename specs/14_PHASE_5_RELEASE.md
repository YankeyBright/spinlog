# Phase 5: Trusted Release

## Preconditions

1. Protect `main`, version tags, workflow files, and the GitHub `release` environment.
2. Configure npm Trusted Publishing for owner `YankeyBright`, repository `spinlog`, workflow `release.yml`, environment `release`, and permission to publish.
3. Confirm the repository and package are public and revoke any long-lived npm publish token.
4. Confirm the GitHub-hosted release job uses Node 24 and npm at or above the trusted-publishing minimum.
5. Pass the required Node 22 and Node 24 quality jobs plus the Node 24 supply-chain job.

## Tag-Driven Protocol

1. Set the intended semantic version in both manifest and lockfile.
2. Complete release notes and pass all foundation gates.
3. Create a protected tag named exactly `v<package-version>`.
4. The immutable workflow performs, in order:

```text
npm ci --ignore-scripts
-> verify repository identity and tag/version equality
-> npm run check:phases
-> npm audit --audit-level=low
-> npm publish --provenance --access public
-> create the GitHub Release and attach sbom.json
```

Checkout credentials are not persisted and dependency caching is disabled for release builds.

## Post-Publish Verification

Run `npm audit signatures` and inspect the published version's attestations and file list. Confirm npm provenance names `YankeyBright/spinlog`, and confirm the npm tarball and GitHub Release contain the validated SBOM.

## Definition Of Done

A release is complete only when package, tag, repository, provenance, SBOM, signature, and foundation-gate evidence agree.
