# Security Assurance Requirements

## Practice Mapping

| Practice | Repository evidence |
| --- | --- |
| Defined ownership and response | Protected repository settings plus `SECURITY.md`. |
| Controlled reuse | Empty consumer dependency maps and a runtime-only SBOM. |
| Reproducible verification | Exact direct pins, lockfile installation, typecheck, tests, artifact checks, and dependency audit. |
| Publication hold | Immutable action commits plus a read-only revalidation workflow that cannot publish, attest, authenticate, or create releases. |
| Vulnerability response | Private GitHub advisory channel and documented acknowledgement target. |

This mapping is engineering evidence, not certification against NIST SSDF, SLSA, an executive order, or another compliance regime.

## Publication Hold

- `.github/workflows/release-readiness.yml` runs only by manual dispatch and has exactly `contents: read` permission.
- It may install with `npm ci --ignore-scripts` and revalidate Phases 0 through 4, but it cannot run on tags, request OIDC, attest, access npm credentials, publish, or create a GitHub release.
- The obsolete preview receipt cannot authorize the changed runtime. A new reviewed release contract must define the future trusted-publishing workflow, protected environment, exact HTTPS registry, provenance, and post-publication verification.

OIDC provenance supplies cryptographic build-origin evidence. It does not prove source correctness or independently confer a SLSA level.

## Runtime SBOM

`npm run sbom` invokes npm's native lockfile-only SBOM command, omits development, optional, and peer classes, and canonicalizes volatile metadata into a reproducible CycloneDX 1.5 library document. `npm run sbom:check` requires the package name/version, repository, purl, library type, root-only dependency graph, reproducibility marker, and an empty runtime component list.

Phase 3 also emits a separate build-tool CycloneDX inventory and candidate manifest outside the npm payload. Those artifacts prove development dependency composition and digest identity without misrepresenting build tools as consumer runtime dependencies.

The SBOM represents the consumer runtime package, not the development workstation or GitHub-hosted build environment. Include it in the npm package; attach release evidence only after a new publication policy is approved.

## Evidence Discipline

- Do not claim API, compatibility, size, signature, provenance, or vulnerability guarantees beyond the corresponding verified artifact and current scan result.
- Record exact proof commands and outcomes in implementation notes.
- Recheck public repository identity and npm trusted-publisher settings before first publication.
- Run `npm audit signatures` and inspect npm attestations only after a future approved publication.
