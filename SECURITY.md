# Security Policy

## Supported Versions

No production version of `spinlog` has been published. Security fixes currently target the default branch and the completed Phase 0 through Phase 2 implementation.

The v1 runtime requires Node.js `^22.13.0 || ^24.0.0`. Users must run security-supported patch releases from those lines.

## Reporting A Vulnerability

Use a private GitHub Security Advisory in [`YankeyBright/spinlog`](https://github.com/YankeyBright/spinlog/security/advisories/new). Do not open a public issue for an undisclosed vulnerability.

Maintainers target acknowledgement within five business days. Severity, remediation, release timing, and disclosure are determined after triage; acknowledgement is not a promise of a fixed resolution date.

## Security Controls

- **Runtime graph:** The published manifest declares no runtime, optional, or peer dependencies.
- **Lifecycle policy:** Package install, prepare, publish, and pack lifecycle hooks are prohibited.
- **Install isolation:** CI uses `npm ci --ignore-scripts` for development-tool installation.
- **Package payload:** A dry-run allowlist limits the files admitted to npm.
- **Build graph:** Direct development tools are exact-pinned, lockfile-resolved, audited, and excluded from the runtime SBOM.
- **Publication:** The current release-readiness workflow is read-only and cannot publish. Phase 5 will introduce protected OIDC trusted publishing without a long-lived npm token.
- **Provenance:** Future public releases must include npm provenance tied to `YankeyBright/spinlog` and a validated runtime-only CycloneDX 1.5 SBOM.
- **Host ownership:** The library installs no process signal listener and never terminates its host process.

These controls reduce defined risks but do not eliminate compromise, maintainer, CI, registry, or application-level risk.
