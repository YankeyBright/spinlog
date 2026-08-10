# Canonical Phase Map

This specification is the single source of truth for phase numbering across the tracked specifications, README, and automated phase gates. A phase name or responsibility may change only through a coordinated update to this file and every authoritative consumer validated by `npm run check:phase-map`.

| Phase | Name | Responsibility | Completion Gate |
| --- | --- | --- | --- |
| 0 | Product and Spec Lock | Freeze the v1 boundary, deferred features, package identity, stream policy, and invariants. | `npm run check:phase0` |
| 1 | Package Scaffolding | Establish the secure package shell, build and test tooling, size and package controls, and release preparation. | `npm run check:phase1` and `npm run check:phase1:release` |
| 2 | Core Implementation and Testing | Implement the frozen v1 runtime and its behavior-driven tests together. | `npm run check:phase2` |
| 3 | Benchmarking and SBOM Hardening | Prove size and performance and harden runtime inventory evidence. | Defined in the Phase 3 specification |
| 4 | Documentation and Migration | Publish verified usage, audit, and migration guidance after runtime behavior exists. | Defined in the Phase 4 specification |
| 5 | Trusted Release | Publish through OIDC and verify provenance, signatures, and release assets. | Defined in the Phase 5 specification |

## Boundary Rules

- Phase 0 contains policy and contract work only.
- Phase 1 contains package-shell and release-preparation work only; it does not implement the v1 runtime.
- Phase 2 is the first runtime implementation phase, and tests ship with each runtime behavior.
- Task groups, progress bars, prompts, intro/outro helpers, and structured logging remain post-MVP rather than Phase 2 scope.
- Local planning notes may preserve historical terminology, but tracked specifications and gates must use this map.
