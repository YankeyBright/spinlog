# Phase 5: Trusted Release

## Release Bootstrap

Phase 5 authorizes one controlled public preview: `spinlog@0.2.0`, created from the immutable `v0.2.0` tag and published to `https://registry.npmjs.org/` with the `next` dist-tag. It does not authorize `latest`, a GitHub Release, or any other version.

`specs/phase5-preview.json` remains the immutable historical freeze. The active machine-readable authorization is `specs/phase5-release.json`; it fixes the package, tag, registry, artifact, authentication, and workflow identities and reports `bootstrap-authorized` until the external publication receipt is reviewed.

The first publication is a one-time human 2FA bootstrap because [npm Trusted Publishing](https://docs.npmjs.com/cli/v11/commands/npm-trust) requires the package to exist before its publisher relationship can be configured. CI builds and attests the exact tarball, and the package owner publishes only that downloaded artifact. No npm token is stored in GitHub or used by the workflow. After the package exists, future releases must use npm Trusted Publishing with OIDC and npm provenance.

## Release Workflows

`.github/workflows/release-publish.yml` runs only for the signed `v0.2.0` tag and calls the same-repository `release-build.yml`. The reusable builder:

- validates the reviewed `main` ancestry, exact package/tag/version identity, and all Phase 0 through Phase 4 gates;
- runs the supported Node 22, 24, and 26 quality and packed-consumer matrix, including the real-spinner TTY and non-TTY smoke checks;
- creates one exact npm tarball, records its source commit and SHA-256/SHA-512 integrity, and verifies the manifest;
- uploads the candidate, waits for every consumer, generates a [GitHub artifact attestation](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations), and uploads the verified release artifact.

Bootstrap workflows may not run `npm publish`, access `NPM_TOKEN` or `NODE_AUTH_TOKEN`, create a GitHub release, select `latest`, or use a mutable action reference. The read-only `release-readiness.yml` remains available for manual revalidation.

## External Controls

- Protect `main` with pull requests, CODEOWNERS review, required CI and CodeQL checks, stale-approval dismissal, signed commits, and blocked force-push/deletion. Protect `v*` tags from unauthorized creation, update, or deletion.
- Require an independent maintainer review for release-policy and workflow changes. Keep the `npm-publish` GitHub environment protected by required reviewers; it is reserved for a future OIDC publisher job.
- Enable npm `auth-and-writes` two-factor authentication for the bootstrap owner. After the first publish, configure npm Trusted Publishing for `release-publish.yml` and revoke publish-capable tokens.
- Keep secret scanning, push protection, dependency alerts, Dependabot security updates, and CodeQL enabled.

## Publication and Verification

After a successful tag workflow, verify the artifact manifest, checksum, and GitHub attestation. Publish the downloaded tarball explicitly with the `next` tag and `--provenance=false` only for this bootstrap; the GitHub attestation is the bootstrap build-origin evidence. Then verify npm registry integrity, signatures, the `next` dist-tag, clean installs, and real spinner behavior on Node 22, 24, and 26. Record the run URL, source commit, tarball digest, registry integrity, and verification results in a reviewed release receipt.

No stable-release, `latest`, npm-OIDC-provenance, SLSA, or zero-vulnerability claim may be made until its corresponding evidence exists. Promotion requires a separate reviewed Phase 5 contract revision.
