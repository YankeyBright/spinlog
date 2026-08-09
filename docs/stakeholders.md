# Stakeholders and Constraints

## Stakeholders

1. **Node.js CLI Developers**
   - **Need:** A small, composable colors-and-spinner primitive for modern CLIs.
   - **Absolute Requirement:** A chainable API that handles nested colors without escape-code leakage.

2. **Security and Compliance Auditors**
   - **Need:** Evidence that the published runtime package has no dependency tree or package lifecycle hooks.
   - **Absolute Requirement:** Verifiable npm provenance and a runtime-only CycloneDX SBOM.

3. **CI/CD Operators**
   - **Need:** Predictable behavior in non-interactive environments.
   - **Absolute Requirement:** No cosmetic `stdout` output and graceful non-TTY degradation.

## Constraints

- The package has zero runtime, optional, and peer dependencies.
- The package is ESM-only and supports Node >=18.
- `dist/index.js` must never exceed 1,228 bytes after gzip compression.
- The release workflow uses GitHub OIDC trusted publishing with npm provenance and no long-lived publish tokens.
- Every release candidate creates and validates a CycloneDX v1.5 runtime SBOM with `components: []`.
- The published package declares no npm lifecycle scripts.

## Non-Goals

- Supporting CommonJS or Node versions earlier than 18.
- Implementing an ANSI AST parser.
- Progress bars, prompts, task groups, intro/outro helpers, and structured logs in the v1 MVP.
- Claiming a formal compliance certification from provenance or SBOM generation alone.

## Risks

1. **Supply-Chain Compromise**
   - *Failure Mode:* An unauthorized actor publishes a package version.
   - *Mitigation:* Protected tags, the GitHub `release` environment, npm OIDC trusted publishing, and post-publish provenance checks.

2. **Runtime Dependency Leak**
   - *Failure Mode:* A package is added to a runtime, optional, or peer dependency map.
   - *Mitigation:* The automated package-policy check, runtime SBOM check, and tarball allowlist check all fail the change.

3. **Terminal State Corruption**
   - *Failure Mode:* A future spinner implementation fails to restore cursor state or leaks cosmetic output to `stdout`.
   - *Mitigation:* Phase 2 tests require cursor restoration, non-TTY behavior, and stream-policy coverage before runtime release.
