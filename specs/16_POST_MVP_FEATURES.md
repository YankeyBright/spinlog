# Post-MVP: Candidate Features

These capabilities remain outside the frozen 0.2 pre-1.0 surface. This specification is the normative deferred-feature list. Inclusion records a candidate for later specification; it does not promise delivery or compatibility.

## Deferred APIs and rationale

- **spinlog.confirm() and spinlog.text()**: Raw input, cancellation, and cross-platform terminal behavior form a separate security boundary.
- **structured: true**: Machine output requires a separately versioned stdout schema.
- **patching console or arbitrary Writable.write()**: Applications own non-Spinlog output; interception would make ordering, error ownership, and shutdown behavior implicit.
- **stdin raw-mode, prompts, or input cancellation**: Spinlog deliberately leaves stdin and process input policy under application control.
- **style chaining, 256-color, and truecolor**: The exact ANSI-16 named-export surface preserves tree-shaking and the fixed size budget.

Every candidate requires its own API, stream, failure, size, security, and behavior-test contract before entering a release phase. Explicit writable streams, target-local leases, intro/outro flow messages, custom frames, `spinlog.group()`, and `spinlog.progress()` are part of the frozen 0.2 contract and are intentionally absent from this list.

CommonJS and browser-first execution are permanent non-goals rather than deferred commitments.
