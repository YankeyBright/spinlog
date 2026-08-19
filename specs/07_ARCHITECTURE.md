# Architecture

## Phase 2 Module Layout

```text
src/
  index.ts    public ESM factory, promise wrapper, types, and style re-exports
  ansi.ts     internal spinner-frame color adapter
  env.ts      color, animation, TTY, CI, and Unicode decisions
  messages.ts stateless intro/outro stderr renderer
  spinner.ts  lifecycle state machine and stderr renderer
  styles.ts   public side-effect-free ANSI-16 style entrypoint
  text.ts     shared validation and render-boundary sanitization
```

Phase 0 and Phase 1 did not create these runtime modules beyond the inert entry point. The declarations in `specs/v1-public-api.d.ts` and `specs/v1-styles-api.d.ts` were specification artifacts until Phase 2 implemented them.

## Responsibilities

### `ansi.ts`

Applies validated spinner-frame colors after `env.ts` has decided capability. It performs no stream or process-lifecycle operations.

### `styles.ts`

Owns the public style-only entrypoint. Helpers validate string input, consult `env.ts`, and delegate SGR composition to Node's stable `styleText`. Nested non-reset styles restore their enclosing style; reset remains a hard SGR boundary. Helpers are side-effect-free and never write streams.

### `env.ts`

Separates color capability from animation capability and implements the exact environment precedence in `specs/v1-behavior.json`. The package is Node-only, so it does not carry browser emulation.

### `spinner.ts`

Owns lifecycle state, unreferenced timer creation and cleanup, mutable properties, cursor visibility during active animation, static degradation, and synchronous write containment. It writes only to stderr and does not install process or stream-global listeners.

### `text.ts`

Owns shared string validation, render-boundary sanitization, and the contained synchronous stderr write primitive. It preserves caller-owned values, ignores backpressure, and installs no stream listener.

### `messages.ts`

Owns stateless intro/outro line composition and its single contained stderr write. It reuses `env.ts`, `ansi.ts`, and `text.ts` and never observes spinner state.

### `index.ts`

Exports the callable default factory, promise overload implementation, intro/outro methods, type surface, and exact named style functions. It adds no CommonJS wrapper or post-MVP API; style-only users may import `spinlog/styles` without bundling the spinner.

## Ownership Rules

- The library owns only resources created by a spinner instance.
- Explicit lifecycle methods clear instance timers and restore cursor state.
- The host application owns signals, process termination, and asynchronous stream errors.
- Multiple simultaneously active spinners are unsupported until a coordinated renderer is specified.
- Runtime code uses Node built-ins and local modules only.
- The Phase 2 gate must compare emitted declarations and runtime exports with the frozen Phase 0 contract.
- The build emits linked source maps for diagnostics, while the npm payload remains an exact allowlist.
