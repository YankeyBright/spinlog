# Security Policy

## Supported Versions

No production version of `spinlog` has been published. Security fixes currently target the default branch and the Phase 0/1 package shell only.

The planned v1 runtime supports the Node.js 22 and 24 LTS majors. Users must run security-supported patch releases from those lines.

## Reporting A Vulnerability

Use a private GitHub Security Advisory in [`YankeyBright/spinlog`](https://github.com/YankeyBright/spinlog/security/advisories/new). Do not open a public issue for an undisclosed vulnerability.

Maintainers target acknowledgement within five business days. Severity, remediation, release timing, and disclosure are determined after triage; acknowledgement is not a promise of a fixed resolution date.

## Security Controls

- **Runtime graph:** The published manifest declares no runtime, optional, or peer dependencies.
- **Lifecycle policy:** Package install, prepare, publish, and pack lifecycle hooks are prohibited.
- **Install isolation:** CI uses `npm ci --ignore-scripts` for development-tool installation.
- **Package payload:** A dry-run allowlist limits the files admitted to npm.
- **Build graph:** Direct development tools are exact-pinned, lockfile-resolved, audited, and excluded from the runtime SBOM.
- **Publication:** The protected GitHub release workflow uses OIDC trusted publishing without a long-lived npm publish token.
- **Provenance:** Public releases include npm provenance tied to `YankeyBright/spinlog` and a validated runtime-only CycloneDX 1.5 SBOM.
- **Host ownership:** The planned library installs no process signal listener and never terminates its host process.

These controls reduce defined risks but do not eliminate compromise, maintainer, CI, registry, or application-level risk.
