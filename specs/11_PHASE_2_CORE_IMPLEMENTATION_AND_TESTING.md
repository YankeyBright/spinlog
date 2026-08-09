# Phase 2: Core Implementation and Testing

## Goal

Implement and prove the frozen v1 runtime API. Runtime code and its behavior-driven tests are delivered together; a feature is not complete without deterministic tests and all package invariants passing.

## Runtime Modules

1. `src/ansi.ts`
   - Hardcode the required SGR foreground, bright foreground, background, bright background, and modifier codes.
   - Export independently tree-shakeable color and modifier functions.
   - Restore enclosing styles correctly for nested formatting.
   - Export cursor hide, cursor show, and line-clear control sequences for the renderer.
2. `src/env.ts`
   - Isolate `NO_COLOR`, `FORCE_COLOR`, TTY, CI, dumb-terminal, and Unicode detection.
   - Guard process access and degrade safely when terminal capabilities are unavailable.
3. `src/signal.ts`
   - Install SIGINT and SIGTERM handlers once.
   - Restore cursor visibility synchronously before conventional signal exits.
4. `src/spinner.ts`
   - Implement start, stop, succeed, fail, warn, and info transitions.
   - Use an 80ms animation cadence only in interactive terminals.
   - Route all cosmetic output to stderr and tolerate write failures.
   - Support live mutation of text, color, prefix, and suffix.
5. `src/index.ts`
   - Export the spinner factory and named color helpers.
   - Implement `spinlog.promise(...)` for promises and async functions.
   - Preserve ESM-only, zero-runtime-dependency behavior.

## Required Behavior Tests

- ANSI tests prove open/close sequences, modifiers, backgrounds, nested restoration, and disabled-color behavior.
- Environment tests prove precedence for `NO_COLOR`, `FORCE_COLOR`, TTY, CI, and non-TTY operation.
- Spinner tests use fake timers and mocked streams to prove cadence, cursor restoration, state transitions, mutation, and interval cleanup.
- Signal tests prove singleton registration, synchronous restoration, and conventional exit codes.
- Integration tests prove promise resolution and rejection, static CI output, no stdout pollution, and write-failure containment.

Tests make no network calls. Every `src/**/*.ts` file must maintain 100% statements, branches, functions, and lines globally and per file. Coverage metrics supplement behavior assertions; they do not replace them.

## Explicit Exclusions

Task groups, progress bars, prompts, intro/outro helpers, structured JSON logging, CommonJS, and browser-first support remain post-MVP.

## Definition of Done

```bash
npm run test:coverage
npm run check:phase1
npm run check:phases
npm audit --audit-level=low
```

The runtime is complete only when behavior tests, stream policy, ESM importability, declaration emit, size, package allowlisting, SBOM validation, and release policy all pass.
