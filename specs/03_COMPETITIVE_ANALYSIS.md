# Competitive Landscape

This document identifies product categories and migration expectations. It does not freeze competitor versions, benchmark claims, or v1 scope; the Phase 0 machine contracts are authoritative.

## Product Categories

- **Color libraries:** Chalk, picocolors, yoctocolors, ansis, and Node's built-in styling cover terminal text but not spinner lifecycle.
- **Spinner libraries:** Ora and nanospinner cover indeterminate terminal feedback with broader or different option surfaces.
- **Task and prompt systems:** listr2, Clack, and Inquirer own orchestration or input domains intentionally excluded from v1.

`spinlog` is not a drop-in API replacement for these packages. Its v1 goal is a deliberately smaller combination of ANSI-16 style functions, caller-defined spinner frames, one leased terminal surface, coordinated task rows, and determinate progress under a strict package and stream policy.

## Feature Ownership

| Capability | Reference category | spinlog position | Phase |
| --- | --- | --- | --- |
| Color functions (red, green, blue, etc.) | chalk, picocolors | Frozen v1 surface | Phase 2 |
| Tree-shakeable named style exports | picocolors, yoctocolors | Frozen v1 surface | Phase 2 |
| Spinner with built-in or caller-defined frames | ora | Frozen v1 surface | Phase 2 |
| Succeed/fail/warn/info lifecycle | ora | Frozen v1 surface | Phase 2 |
| Text/color/prefix/suffix mutation | spinner libraries | Frozen v1 surface | Phase 2 |
| Non-TTY static degradation | spinner libraries | Frozen v1 behavior | Phase 2 |
| Promise wrapping | spinner libraries | Frozen v1 behavior | Phase 2 |
| Coordinated task groups | task libraries | Frozen v1 surface | Phase 2 |
| Determinate progress | progress libraries | Frozen v1 surface | Phase 2 |
| Prompts | input libraries | Explicitly deferred | Post-MVP |
| Structured stdout schemas | logging libraries | Explicitly deferred | Post-MVP |
| npm OIDC provenance configuration | release infrastructure | Package control | Phase 1 |
| Runtime-only CycloneDX SBOM | release infrastructure | Package control | Phase 1 |

## Evaluation Rules

- Benchmark only released, pinned versions and record commands, platform, and date.
- Compare equivalent public behavior rather than marketing categories.
- Distinguish runtime dependencies from development tooling.
- Do not claim that provenance, SBOMs, or a zero-dependency graph eliminate risk.
- Do not claim API compatibility until Phase 2 behavior and migration tests prove it.
