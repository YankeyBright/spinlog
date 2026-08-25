# Changelog

All notable changes to this project will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Frozen v1 color, spinner, mutation, lifecycle, and promise APIs.
- ESM-only root and `spinlog/styles` entrypoints.
- Exact package, coverage, size, consumer, SBOM, and release-freeze gates.
- The pre-1.0 `0.2.0` redesign: explicit writable render targets, target-local interactive leases, practical color/Unicode/cursor/indent controls, and bounded backpressure recovery.
- Group height budgets, persisted row sessions, restart recovery, and a timer-free progress surface with immutable totals, floor fill, configurable 5–40-cell bars, and success-to-100 semantics.
- Generic promise settlement text and target-aware intro/outro flow messages.
- Publication is blocked until fresh terminal, benchmark, reproducibility, consumer, SBOM, and documentation evidence is reviewed for the 0.2 contract.

### Changed

- Named terminal capabilities separate SGR, cursor control, color, emphasis, animation, and Unicode decisions.
- `NO_COLOR` and `NODE_DISABLE_COLORS` now suppress colors without suppressing explicit interactive emphasis.
- ANSI metadata and lazy render snapshots harden nested styling, spinner color validation, and repeated frame rendering.
- Phase 3 benchmark, reproducibility, SBOM, consumer, and release-policy evidence must be regenerated before publication.
- The root gzip contract is 10,240 bytes; the single-style tree-shaking budget is 768 bytes.

### Security

- Single-line terminal text sanitization, contained cosmetic write failures, and host-process non-ownership.
- Zero consumer runtime dependencies and no npm lifecycle scripts.
- GitHub OIDC publishing, immutable action commits, tarball/SBOM attestations, CodeQL analysis, and post-publish integrity verification.

[Unreleased]: https://github.com/YankeyBright/spinlog/commits/main
