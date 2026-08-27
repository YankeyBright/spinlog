# Architecture

## Phase 2 module layout

```text
src/
  index.ts            public ESM factory, promise wrapper, types, and style re-exports
  ansi.ts             canonical SGR registry and validation
  env.ts              target-local terminal capability resolution
  text.ts             RenderTarget, validation, sanitization, width, and write outcomes
  renderer.ts         coordinated-write and lease facade
  renderer-types.ts   renderer task, lease, waiter, and target-state contracts
  renderer-queue.ts   WeakMap target queues, backpressure, and stream completion
  terminal-control.ts shared cursor and line-control sequences
  spinner-data.ts     sole built-in frames, intervals, statuses, colors, and fallbacks
  spinner-options.ts  shared surface-option validation
  spinner-rendering.ts pure spinner formatting, snapshots, and width calculation
  spinner.ts          single-surface lifecycle and scheduling
  group-rendering.ts  group row data, snapshots, width, and formatting
  group.ts            group sessions, persisted rows, height safety, and scheduling
  progress.ts         determinate rendering and immutable total/value state
  messages.ts         target-local intro/outro composition
  styles.ts           tree-shakeable ANSI-16 style entrypoint
```

## Target and lease boundaries

`text.ts` resolves a `RenderTarget` around a caller-supplied `Writable` or `process.stderr`. It does not modify the target. TTY state, width, and height are read live so resize safety requires no process-global listener. It returns typed synchronous write outcomes: `written`, `backpressured`, or `failed`.

`renderer-queue.ts` owns a `WeakMap<Writable, TargetState>` behind the `renderer.ts` facade. Each identity has at most one interactive surface. A group owns multiple rows through one lease; roots on independent streams do not contend. Ready permanent output is attempted immediately and receives a sequence watermark that completes on Node’s write callback. During backpressure, only the latest cosmetic frame is retained while pending permanent output is capped at 64 tasks or 64 KiB. Temporary `drain`, `finish`, `close`, and `error` listeners resume, resolve, or reject target-local work; target errors are observed only while Spinlog output is pending.

## Surface boundaries

`spinner-data.ts` is the sole source of truth for dots/line frames, ANSI-16 status colors, status glyphs, default interval, and built-in Unicode fallback. `spinner.ts`, `group-rendering.ts`, and `progress.ts` consume that data rather than duplicating tables.

`spinner.ts` owns one mutable spinner’s lifecycle, unreferenced timer, cursor policy, static degradation, and explicit cleanup. `spinner-options.ts` centralizes shared validation, while `spinner-rendering.ts` owns lazy sanitized text snapshots and grapheme-aware formatting. Caller-defined frames are sanitized and frozen by `spinner-data.ts` when their definition is accepted. Failures remain scoped to the affected target surface.

`group.ts` owns the multi-row session lifecycle. It distinguishes live rows, permanently persisted rows, and explicitly stopped children eligible for a fresh session. It requires width and height capacity before lease acquisition and atomically demotes all active rows on constraint loss. `group-rendering.ts` contains pure row formatting and cached measurements.

`progress.ts` owns a timer-free determinate surface. It keeps total private and exposes it through a getter, validates exact value bounds and positive increments, uses floor-based fill, and completes to total on success. It shares target-local rendering primitives with spinner and group.

`messages.ts` writes stateless target-local intro/outro lines. `styles.ts` remains stream-free and only returns ANSI strings.

## Ownership rules

- The library owns only timers, cursor state, leases, and temporary drain/finish/close/error listeners created for one target while its output is pending.
- The host application owns direct stream writes, stdin, signals, process termination, and asynchronous stream errors unrelated to pending Spinlog output.
- Explicit lifecycle methods and `Symbol.dispose` release a surface’s resources.
- The implementation uses Node built-ins and local modules only.
- Emitted declarations and runtime exports must match the Phase 0 contract; the root implementation stays within the 10,240-byte gzip ceiling.
