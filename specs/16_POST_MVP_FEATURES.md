# Post-MVP: Competitive Edge Features

**Goal:** Implement the features that make `spinlog` the undisputed replacement for listr2, clack, cli-progress, and inquirer — without compromising the zero-dependency, sub-1.2kB architecture.

These features are what elevate spinlog from "ora alternative" to "the zero-dependency CLI toolkit." They are implemented only after the Phase 2 core is stable and tested.

## 1. Sequential Task Grouping (Replaces: listr2, tasuku)
File: `src/group.ts` and `test/group.test.ts`
- **Objective:** Provide a step-logger API that replaces listr2 for the 80% use case.
- **Implementation:**
  - `spinlog.group(tasks)` accepts an array of task objects `{ text, task: async (ctx) => {} }`.
  - Runs tasks **sequentially**.
  - When a task finishes, collapses it into a static success line and begins spinning the next task on the line below.
  - **Task context passing** (listr2 parity): A shared `ctx` object is passed to each task function. Tasks can set properties on `ctx` that downstream tasks can read:
    ```ts
    const tasks = spinlog.group([
      { text: 'Fetch config', task: async (ctx) => { ctx.config = await loadConfig() } },
      { text: 'Build', task: async (ctx) => { await build(ctx.config) } }
    ])
    const result = await tasks.run() // result = final ctx
    ```
  - On task failure: mark the failed task with ✖, skip remaining tasks, return error context.
  - Non-TTY: print each task as a static line (no animation).

## 2. Microscopic Interactive Prompts (Replaces: @clack/prompts, inquirer)
File: `src/prompt.ts` and `test/prompt.test.ts`
- **Objective:** Eliminate the need for `inquirer` or `@clack/prompts` for the two most common prompt types.
- **Implementation:**
  - `spinlog.confirm('Continue? y/n')` -> returns `Promise<boolean>`
  - `spinlog.text('Enter name:')` -> returns `Promise<string>`
  - Reuse the existing ANSI engine. Read directly from `process.stdin` in raw mode.
  - Non-TTY: throw clear error ("Prompts require an interactive terminal").

## 3. Inline Progress Bars (Replaces: cli-progress)
File: `src/progress.ts` and `test/progress.test.ts`
- **Objective:** Unified API for determinate waiting (spinner = indeterminate, progress = determinate).
- **Implementation:**
  - `const bar = spinlog.progress('Uploading')` creates a progress bar instance
  - `bar.update(0.6)` visually renders `[██████░░░░] 60%`
  - `bar.succeed('Done')` / `bar.fail('Error')` for state transitions
  - Reuses the existing terminal clearing engine (`\x1b[2K\r`) and `stderr` routing.
  - Non-TTY: print percentage updates as static lines (e.g., `Uploading... 60%`)

## 4. Dual-Stream Enterprise Logging (Unique to spinlog)
File: Integrated into `src/spinner.ts` and `src/index.ts`
- **Objective:** No competitor offers this. Cater to enterprise telemetry needs.
- **Implementation:**
  - If initialized with `{ structured: true }`, any visual state change (e.g., `succeed()`, `fail()`) written to `stderr` will also emit a machine-readable JSON log payload to `stdout`.
  - JSON format: `{"level":"info","msg":"Deployed","state":"succeed","ts":"2026-08-08T14:00:00Z"}`
  - Keeps `stdout` completely clean for data piping unless explicitly enabled.

## 5. Intro/Outro Flow Helpers (Replaces: @clack/prompts intro/outro)
File: `src/index.ts`
- **Objective:** Provide the polished "session wrapper" pattern that makes clack feel premium.
- **Implementation:**
  - `spinlog.intro('My CLI v1.0')` -> prints a styled header bar to stderr
  - `spinlog.outro('All done!')` -> prints a styled footer bar to stderr
  - Simple cosmetic output, no state management. Uses the color engine.
  - Non-TTY: prints plain text without styling.
