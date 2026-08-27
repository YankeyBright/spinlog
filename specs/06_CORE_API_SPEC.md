# Core API Specification

`specs/v1-public-api.d.ts`, `specs/v1-styles-api.d.ts`, and `specs/v1-behavior.json` are the normative 0.2 pre-1.0 API contract. Implementation and emitted declarations must conform exactly; undocumented exports are contract violations.

## Export surface

The default export is the callable `spinlog` factory. Named types are `FlowOptions`, `GroupOptions`, `PromiseOptions`, `Progress`, `ProgressOptions`, `RenderOptions`, `Spinlog`, `Spinner`, `SpinnerColor`, `SpinnerDefinition`, `SpinnerGroup`, `SpinnerName`, `SpinnerOptions`, and `UnicodeMode`. Runtime named exports are exactly the 38 ANSI-16 style functions. `spinlog/styles` exports the same styles and `Style` without spinner runtime.

The callable has exactly five methods: `promise`, `intro`, `outro`, `group`, and `progress`. It adds no aliases, CommonJS wrapper, truecolor API, prompt API, structured-log API, or global-output interception.

## Render options

`RenderOptions` is shared by spinner, group, progress, and promise options:

- `stream?: Writable` defaults to `process.stderr`.
- `color?: SpinnerColor | false` defaults to cyan. `false` disables automatic frame and status color.
- `unicode?: 'auto' | boolean` defaults to auto. `false` selects ASCII built-ins.
- `hideCursor?: boolean` defaults to `true`.
- `indent?: number` is a safe integer from 0 through 40 and defaults to zero.
- `static?: 'symbol' | 'text' | 'silent'` defaults to `'symbol'`.
- `terminal?: 'auto' | 'static' | 'interactive'` defaults to `'auto'`.

`FlowOptions` deliberately exposes only `stream`, `color`, `unicode`, and `indent`, because flow lines are stateless and never own an interactive lease. All output coordination is target-local. One interactive surface may own each writable stream; independent stream identities may animate concurrently.

## Spinner and custom frames

`spinlog(text?, options?)` returns a `Spinner`. Its mutable fields are exactly `text`, `color`, `prefix`, and `suffix`. `start`, `stop`, `log`, `succeed`, `fail`, `warn`, and `info` return the same instance; `Symbol.dispose` is equivalent to `stop` and non-enumerable.

`spinner.log(message)` validates and sanitizes its string before effects, writes one permanent newline-terminated line on the spinner’s target, and does not change lifecycle state, timers, or cursor ownership. On an active target it clears, writes, and redraws the owned frame as one coordinated transaction.

Spinner names are `dots` and `line`. A `SpinnerDefinition` has one to 64 visible frames and an optional safe-integer interval from 16 through 60,000ms. Caller-defined frames are sanitized, validated for visibility, and frozen when the definition is snapshotted before output. A one-frame definition stays static and owns no timer.

## Groups

`spinlog.group(options?)` creates a target-local multi-row surface. `group.add(text?, options?)` creates an idle child. Children inherit target, static policy, terminal policy, Unicode policy, cursor policy, and indentation; child options may choose color, prefix, suffix, and spinner definition only. `group.stop()` stops all active children and `Symbol.dispose` performs the same cleanup.

`maxRows` is a positive safe integer. Its dynamic default is `min(10, target.rows - 1)`. Groups must fit width and known height before acquiring a lease. A height or width loss demotes the complete surface atomically. Static and settled output is persisted and never re-rendered in later sessions. A static child must be explicitly stopped and restarted before it is eligible for a new interactive session; once a session has no active rows, it releases its target-local lease. Groups do not nest or reorder rows dynamically.

## Progress

`spinlog.progress(text, { total, value?, width?, style?, ...options })` returns `Progress`. `total` is a positive safe integer and is exposed as an immutable runtime getter. `value` and `update(value)` are safe integers in the inclusive range zero through total. `increment(amount?)` defaults to one and accepts only positive safe integers, preserving value on invalid input.

Progress width is a safe integer from 5 through 40, default 20. Style is `'blocks'` by default or `'ascii'`; blocks automatically fall back to ASCII when Unicode is unavailable. Fill is calculated with `Math.floor`, preventing visual overstatement. `succeed()` first sets the value to total. `fail()`, `warn()`, and `info()` retain the actual value. Progress owns no timer.

## Promise and flow methods

`spinlog.promise(...)` has generic overloads for a `PromiseLike<T>` and a zero-argument function returning `PromiseLike<T>`. Both return `Promise<T>`. The spinner starts before observing the input or invoking the callback; thenables are assimilated, synchronous callback throws become rejections, and cosmetic failures never change fulfillment values or rejection reasons.

`PromiseOptions<T>` includes `text`, all spinner render options, `successText?: string | ((value: T) => string)`, and `failText?: string | ((error: unknown) => string)`. Fulfillment calls `succeed` with the resolved text; rejection calls `fail` with the resolved failure text.

`spinlog.intro(message?, options?)` and `spinlog.outro(message?, options?)` emit one sanitized, newline-terminated flow line to their target. Unicode markers are `┌` and `└`; ASCII fallback markers are `>` and `<`. Calls are synchronous, stateless, repeatable, and coordinate only with the active surface on that target.

## Lifecycle, validation, and non-goals

The lifecycle states are `idle`, `spinning`, `stopped`, `succeeded`, `failed`, `warned`, and `informed`. `start()` is idempotent while spinning; any terminal state can begin a fresh cycle. The first terminal result in a cycle wins. Input validation occurs before output and before idempotency can suppress it. Mutable-property failures preserve the previous value.

Spinlog never owns stdin, signals, process exit, or arbitrary stream writes. It leaves unrelated asynchronous stream errors to the host, but temporarily observes an error for its own pending permanent output to reject `flush()` and clean only target-local state. The exact deferred rationale appears in `specs/16_POST_MVP_FEATURES.md`. CommonJS and browser-first runtime remain permanent non-goals.
