# Security Policy

## Supported Versions
No package version is currently authorized for publication. The `spinlog@0.2.0` pre-1.0 preview target is blocked pending revalidation of the target-local terminal UX redesign. Security fixes target the default branch.

The pre-1.0 runtime requires Node.js `^22.13.0 || ^24.0.0 || ^26.0.0`. Users must run security-supported patch releases from those lines.

## Reporting A Vulnerability
Use a private GitHub Security Advisory in [`YankeyBright/spinlog`](https://github.com/YankeyBright/spinlog/security/advisories/new). Do not open a public issue for an undisclosed vulnerability.

Maintainers target acknowledgement within five business days. Severity, remediation, release timing, and disclosure are determined after triage; acknowledgement is not a promise of a fixed resolution date.

## Security Controls

- **Runtime graph:** The published manifest declares no runtime, optional, or peer dependencies.
- **Lifecycle policy:** Package install, prepare, publish, and pack lifecycle hooks are prohibited.
- **Install isolation:** CI uses `npm ci --ignore-scripts` for development-tool installation.
- **Package payload:** A dry-run allowlist limits the files admitted to npm.
- **Build graph:** Direct development tools are exact-pinned, lockfile-resolved, audited, and excluded from the runtime SBOM.
- **Publication hold:** The only release workflow is manual and read-only. It cannot publish, request OIDC, attest, create releases, or use registry credentials.
- **Future provenance:** A new reviewed policy must restore an attested exact-tarball builder and post-publish verification only after fresh Phase 3 and Phase 4 evidence is accepted.
- **Host ownership:** The library installs no process signal listener and never terminates its host process.

These controls reduce defined risks but do not eliminate compromise, maintainer, CI, registry, or application-level risk.
