# Architecture

## v1 Module Layout

```text
spinlog/
  src/
    index.ts       public ESM entrypoint, factory, and colors
    ansi.ts        ANSI SGR and cursor control primitives
    env.ts         NO_COLOR, FORCE_COLOR, TTY, and CI detection
    signal.ts      process-wide cursor restoration for termination signals
    spinner.ts     spinner state machine and stderr renderer
  test/
    ansi.test.ts
    env.test.ts
    spinner.test.ts
    signal.test.ts
    integration.test.ts
  scripts/
    check-package-policy.mjs
    check-pack.mjs
    check-sbom.mjs
    check-size.mjs
```

No v1 source module is reserved for task groups, progress bars, prompts, intro/outro helpers, or structured logging. Those features remain post-MVP.

## Module Responsibilities

### `ansi.ts`

Owns compact ANSI sequences for SGR colors, cursor visibility, and line clearing. Nested color closures must restore the outer style without an external parser.

### `env.ts`

Contains all terminal capability decisions so they are testable. It interprets `NO_COLOR`, `FORCE_COLOR`, `stderr.isTTY`, and CI state without changing the output-stream policy.

### `signal.ts`

Installs a singleton `SIGINT` and `SIGTERM` handler only while terminal state needs restoration. Cleanup writes synchronously to `stderr` and preserves the conventional exit codes.

### `spinner.ts`

Owns the finite lifecycle, rendering interval, mutation fields, and transition behavior. It must not import network packages, write cosmetic output to `stdout`, or create an interval in non-TTY or CI mode.

### `index.ts`

Exports the public ESM factory, promise wrapper, and tree-shakeable colors. It contains no CommonJS compatibility wrapper.

## Architectural Rules

- Prefer Node built-ins and local modules only.
- Keep terminal rendering deterministic and state transitions idempotent.
- Keep process and stream interaction behind narrow, mockable boundaries.
- Add coverage in proportion to terminal-state and signal-handling risk; do not use a blanket percentage target as a substitute for scenario coverage.
- Keep post-MVP APIs out of the runtime exports until their own contract, stream rules, and tests are approved.
