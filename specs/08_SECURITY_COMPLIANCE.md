# Security Assurance Requirements

## Practice Mapping

| Practice | Repository evidence |
| --- | --- |
| Defined ownership and response | Protected repository settings plus `SECURITY.md`. |
| Controlled reuse | Empty consumer dependency maps and a runtime-only SBOM. |
| Reproducible verification | Exact direct pins, lockfile installation, typecheck, tests, artifact checks, and dependency audit. |
| Publication bootstrap | Immutable action commits, a read-only revalidation workflow, and a tag builder that attests one exact tarball without npm credentials or stable promotion. |
| Vulnerability response | Private GitHub advisory channel and documented acknowledgement target. |

This mapping is engineering evidence, not certification against NIST SSDF, SLSA, an executive order, or another compliance regime.

## Publication Bootstrap

- `.github/workflows/release-readiness.yml` remains manual-only with exactly `contents: read`; the tag release builder has only the attestation permissions required for its exact artifact.
- The `v0.2.0` bootstrap cannot access npm credentials, publish, select `latest`, or create a GitHub release. The package owner publishes the verified downloaded tarball once with human 2FA.
- After that package exists, a reviewed contract revision must configure the protected `npm-publish` environment and npm Trusted Publishing OIDC for future releases.

OIDC provenance supplies cryptographic build-origin evidence. It does not prove source correctness or independently confer a SLSA level.

## Runtime SBOM

`npm run sbom` invokes npm's native lockfile-only SBOM command, omits development, optional, and peer classes, and canonicalizes volatile metadata into a reproducible CycloneDX 1.5 library document. `npm run sbom:check` requires the package name/version, repository, purl, library type, root-only dependency graph, reproducibility marker, and an empty runtime component list.

Phase 3 also emits a separate build-tool CycloneDX inventory and candidate manifest outside the npm payload. Those artifacts prove development dependency composition and digest identity without misrepresenting build tools as consumer runtime dependencies.

The SBOM represents the consumer runtime package, not the development workstation or GitHub-hosted build environment. Include it in the npm package; attach release evidence only after a new publication policy is approved.

## Evidence Discipline

- Do not claim API, compatibility, size, signature, provenance, or vulnerability guarantees beyond the corresponding verified artifact and current scan result.
- Record exact proof commands and outcomes in implementation notes.
- Recheck public repository identity and npm trusted-publisher settings before first publication.
- Run `npm audit signatures` after the bootstrap and inspect npm attestations only after an OIDC publication.
