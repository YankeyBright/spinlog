# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

Please report vulnerabilities through a private GitHub Security Advisory for this repository. Do not open public issues for security vulnerabilities. The maintainers target acknowledgement within five business days and will provide a remediation status after triage.

## Core Security Invariants

This project adheres to a strict zero-trust model:

- **Zero Runtime Dependencies**: The published package relies only on Node.js built-ins and declares no runtime, optional, or peer dependencies.
- **No Lifecycle Scripts**: The published `package.json` contains no `preinstall`, `install`, `postinstall`, `prepare`, `prepublish`, `prepublishOnly`, `prepack`, or `postpack` script.
- **Controlled Installs**: CI uses `npm ci --ignore-scripts` to prevent transitive dependency install hooks from executing during verification or release.
- **Provenance**: Releases are published from a GitHub-hosted Node 24 runner using npm OIDC trusted publishing and `npm publish --provenance`. The workflow does not use `NPM_TOKEN` or `NODE_AUTH_TOKEN`.
- **SBOM**: A checked CycloneDX v1.5 library SBOM with zero runtime components is included in the npm tarball and GitHub Release.
- **Audit Gate**: The Node 24 supply-chain job fails on any dependency audit finding at low severity or above.
