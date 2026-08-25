# Phase 5: Trusted Release

## Current Status

Phase 5 is intentionally blocked. Terminal UX hardening changed runtime, build, benchmark, dependency, package, and documentation inputs after the prior preview receipt. No tag, package version, registry credential, OIDC token, attestation, or GitHub release workflow may publish `spinlog` until the required revalidation is reviewed.

The file `specs/phase5-preview.json` is the machine-readable release freeze. It identifies the blocked `spinlog@0.2.0` / `v0.2.0` / `next` target and the exact revalidation sequence. The former benchmark receipt is historical evidence only; it is not release authorization.

## Temporary Workflow

`.github/workflows/release-readiness.yml` may run manually on Node `24.19.0` to execute Phase 0 through Phase 4 verification and the required three-run stability check. It has only `contents: read` permission and may not:

- run on tags;
- request OIDC or attestation permissions;
- authenticate to npm or reference publishing credentials;
- invoke `npm publish`, `gh release`, staging, or promotion; or
- write repository, release, or registry state.

The release-freeze validator rejects any relaxation of this workflow.

## Reauthorization Requirements

1. Review the pre-1.0 0.2 Phase 0 contract and Phase 2 runtime behavior.
2. Complete three consecutive full green test runs, including target-local terminal coverage.
3. Collect and independently review a new five-run Linux Node 24 benchmark baseline.
4. Regenerate Phase 3 reproducibility, SBOM, packed-consumer, candidate-manifest, and audit evidence.
5. Complete the Phase 4 documentation review and remote Node 22/24/26 matrices.
6. Approve a new release-policy contract before restoring a same-repository reusable builder and tag workflow.

The future policy must publish only an attested, downloaded tarball to `https://registry.npmjs.org/`, must use npm Trusted Publishing with a protected environment, and must never write `latest` without a separate reviewed contract revision.

## External Controls For Reauthorization

- Keep `main` public and protected: pull requests, required checks, signed commits, no force push, and no branch deletion.
- Require CODEOWNERS review and one maintainer approval for the current repository. Upgrade to two independent maintainers when a second maintainer is onboarded.
- Configure npm Trusted Publishing only after the new workflow filename and protected environment are approved. Require npm two-factor authentication for auth-and-writes and revoke long-lived publish tokens.
- Keep GitHub secret scanning, push protection, dependency alerts, Dependabot security updates, and CodeQL enabled.

This hold is a security control, not a production-readiness claim. A future release remains subject to its own reviewed acceptance evidence.
