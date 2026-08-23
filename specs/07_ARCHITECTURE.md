# Architecture

## Phase 2 Module Layout

```text
src/
  index.ts    public ESM factory, promise wrapper, types, and style re-exports
  ansi.ts     canonical SGR registry, validation, and generic nesting normalization
  ansi-apply.ts SGR composition and metadata-driven restoration primitives
  ansi-metadata.ts read-only SGR definition records
  env.ts      named SGR, cursor, color, emphasis, animation, and Unicode decisions
  messages.ts coordinated intro/outro stderr renderer
  renderer.ts process-local interactive-line lease and coordinated writes
  spinner.ts  lifecycle state machine and stderr renderer
  styles.ts   public side-effect-free ANSI-16 style entrypoint
  text.ts     shared validation, width measurement, and render-boundary sanitization
```

Phase 0 and Phase 1 did not create these runtime modules beyond the inert entry point. The declarations in `specs/v1-public-api.d.ts` and `specs/v1-styles-api.d.ts` were specification artifacts until Phase 2 implemented them.

## Responsibilities

### `ansi.ts`

Owns the canonical metadata table for every supported SGR helper: opening and closing codes, color/emphasis category, foreground spinner eligibility, and nesting-restoration strategy. It performs no stream or process-lifecycle operations.

### `ansi-metadata.ts` and `ansi-apply.ts`

Own the individual metadata records and the small SGR composition primitives. This split keeps the canonical registry available to spinner validation while allowing `spinlog/styles` to retain only the selected helper metadata after bundling. Neither module writes to streams or observes process lifecycle.

### `styles.ts`

Owns the public style-only entrypoint. Helpers validate string input, consult the named `env.ts` capabilities, and delegate SGR composition to metadata-driven primitives. Color helpers require color capability; reset and modifiers require emphasis capability. Nested non-reset styles restore their enclosing style; reset remains a hard SGR boundary. Helpers are side-effect-free and never write streams.

### `env.ts`

Returns a frozen named capability snapshot for SGR, cursor control, color, emphasis, animation, and Unicode. It implements the exact environment precedence and conservative terminal-profile allowlist in `specs/v1-behavior.json`. Automatic animation requires a known cursor-capable profile; the explicit terminal override remains guarded by TTY and `TERM=dumb`. The package is Node-only, so it does not carry browser emulation.

### `spinner.ts`

Owns lifecycle state, unreferenced timer creation and cleanup, mutable properties, cursor visibility during active animation, static-mode selection, conservative width degradation, and synchronous write containment. It lazily caches sanitized fields and their conservative width at the render boundary, invalidating only field mutations that can change terminal text. Its instance-scoped `log()` writes a permanent coordinated stderr line without changing lifecycle resources. It writes only to stderr and does not install process or stream-global listeners.

### `renderer.ts`

Owns the process-local lease for the single interactive terminal line. It composes flow, instance-log, and static-secondary lines with a clear-and-redraw transaction, then notifies the owner when a synchronous cosmetic write fails. It owns neither signals nor stream listeners.

### `text.ts`

Owns shared string validation, render-boundary sanitization, conservative Unicode-cell measurement, and the contained synchronous stderr write primitive. It preserves caller-owned values, ignores backpressure, and installs no stream listener.

### `messages.ts`

Owns intro/outro line composition and one coordinated stderr write. It reuses `env.ts`, `ansi.ts`, `renderer.ts`, and `text.ts` without observing or mutating public spinner state.

### `index.ts`

Exports the callable default factory, promise overload implementation, intro/outro methods, type surface, and exact named style functions. It adds no CommonJS wrapper or post-MVP API; style-only users may import `spinlog/styles` without bundling the spinner.

## Ownership Rules

- The library owns only resources created by a spinner instance.
- Explicit lifecycle methods and `Symbol.dispose` clear instance timers and restore cursor state.
- The host application owns signals, process termination, and asynchronous stream errors.
- One spinner may animate interactively; simultaneous later spinners degrade to safe static output until a multi-row renderer is specified.
- Runtime code uses Node built-ins and local modules only.
- The Phase 2 gate must compare emitted declarations and runtime exports with the frozen Phase 0 contract.
- The build emits linked source maps for diagnostics, while the npm payload remains an exact allowlist.
