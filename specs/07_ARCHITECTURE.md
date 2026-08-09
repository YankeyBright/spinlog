# Architecture

## Phase 2 Module Layout

```text
src/
  index.ts    public ESM factory, promise wrapper, and named styles
  ansi.ts     ANSI style, cursor, and line-control primitives
  env.ts      color, animation, TTY, CI, and Unicode decisions
  spinner.ts  lifecycle state machine and stderr renderer
```

Phase 0 and Phase 1 do not create these runtime modules beyond the inert entry point. The declarations in `specs/v1-public-api.d.ts` are a specification artifact and are not published until Phase 2 implements them.

## Responsibilities

### `ansi.ts`

Owns compact ANSI sequences and pure style functions. Nested closures restore the enclosing style without an external parser. It performs no stream or process-lifecycle operations.

### `env.ts`

Separates color capability from animation capability and implements the exact environment precedence in `specs/v1-behavior.json`. The package is Node-only, so it does not carry browser emulation.

### `spinner.ts`

Owns lifecycle state, timer creation and cleanup, mutable properties, rendering, cursor visibility during active animation, static degradation, and synchronous write containment. It writes only to stderr and does not install process or stream-global listeners.

### `index.ts`

Exports the callable default factory, promise overload implementation, type surface, and exact named style functions. It adds no CommonJS wrapper or post-MVP API.

## Ownership Rules

- The library owns only resources created by a spinner instance.
- Explicit lifecycle methods clear instance timers and restore cursor state.
- The host application owns signals, process termination, and asynchronous stream errors.
- Multiple simultaneously active spinners are unsupported until a coordinated renderer is specified.
- Runtime code uses Node built-ins and local modules only.
- The Phase 2 gate must compare emitted declarations and runtime exports with the frozen Phase 0 contract.
