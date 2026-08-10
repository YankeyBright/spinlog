# Security Assurance Requirements

## Practice Mapping

| Practice | Repository evidence |
| --- | --- |
| Defined ownership and response | Protected repository settings plus `SECURITY.md`. |
| Controlled reuse | Empty consumer dependency maps and a runtime-only SBOM. |
| Reproducible verification | Exact direct pins, lockfile installation, typecheck, tests, artifact checks, and dependency audit. |
| Protected publication | Public-repository OIDC, immutable action commits, protected release environment, tag validation, and no long-lived publish token. |
| Vulnerability response | Private GitHub advisory channel and documented acknowledgement target. |

This mapping is engineering evidence, not certification against NIST SSDF, SLSA, an executive order, or another compliance regime.

## Trusted Publishing

- Before Phase 5, `.github/workflows/release-readiness.yml` is verification-only and has no tag trigger, write permission, OIDC permission, publish command, or release command.
- Phase 5 creates `.github/workflows/release.yml`; publish only from that workflow in `YankeyBright/spinlog`.
- Require `id-token: write`, Node 24, npm at or above 11.5.1, and the protected `release` environment.
- Configure npm with the exact owner, repository, workflow filename, environment, and allowed publish action.
- Use `npm publish --provenance --access public` and no `NPM_TOKEN` or `NODE_AUTH_TOKEN`.
- Keep the repository and package public because private-repository provenance is unsupported.
- Verify tag/version equality, dependency audit, package gates, and provenance before declaring a release complete.

OIDC provenance supplies cryptographic build-origin evidence. It does not prove source correctness or independently confer a SLSA level.

## Runtime SBOM

`npm run sbom` invokes npm's native lockfile-only SBOM command, omits development, optional, and peer classes, and canonicalizes volatile metadata into a reproducible CycloneDX 1.5 library document. `npm run sbom:check` requires the package name/version, repository, purl, library type, root-only dependency graph, reproducibility marker, and an empty runtime component list.

The SBOM represents the consumer runtime package, not the development workstation or GitHub-hosted build environment. Attach it to both the npm package and GitHub Release.

## Evidence Discipline

- Do not publish API, compatibility, size, signature, or provenance claims before the corresponding artifact exists.
- Record exact proof commands and outcomes in implementation notes.
- Recheck public repository identity and npm trusted-publisher settings before first publication.
- Run `npm audit signatures` and inspect npm attestations after publication.
