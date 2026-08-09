# Post-MVP: Candidate Features

These capabilities may be specified only after the Phase 2 core is stable and tested. This specification is the normative deferred-feature list. Inclusion records a candidate for later specification; it does not promise delivery or a compatibility surface.

## Deferred APIs And Rationale

- **spinlog.group()**: Concurrent task orchestration requires a separate state and rendering contract.
- **spinlog.progress()**: Determinate progress needs independent update, throttling, and non-TTY semantics.
- **spinlog.confirm() and spinlog.text()**: Raw input, cancellation, and cross-platform terminal behavior form a separate security boundary.
- **spinlog.intro() and spinlog.outro()**: Flow decoration is not required by the core color and spinner primitive.
- **structured: true**: Machine output requires a separately versioned stdout schema.
- **custom frames and intervals**: Arbitrary animation data expands validation, timing, and size requirements.
- **custom writable streams**: The v1 stderr-only contract intentionally avoids stream ownership and error-listener complexity.
- **multiple active spinners**: Shared-line coordination belongs with the deferred task-group renderer.
- **style chaining, 256-color, and truecolor**: The exact ANSI-16 named-export surface preserves tree-shaking and the fixed size budget.

Every candidate requires its own API, stream, failure, size, security, and behavior-test contract before entering a release phase. None is available in v1.

CommonJS and browser-first execution are v1 non-goals rather than deferred commitments.
