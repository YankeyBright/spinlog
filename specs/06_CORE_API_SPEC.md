# Core API Specification

The public declarations in `specs/v1-public-api.d.ts` and `specs/v1-styles-api.d.ts`, plus the behavior model in `specs/v1-behavior.json`, are the normative v1 API contract. Phase 2 implementation and declarations must conform exactly; undocumented exports are contract violations.

## Export Surface

The default export is the callable `spinlog` factory. Named type exports are `SpinnerName`, `SpinnerColor`, `SpinnerOptions`, `PromiseOptions`, `Spinner`, and `Spinlog`.

Named runtime exports are exactly:

- Modifiers: `reset`, `bold`, `dim`, `italic`, `underline`, `strikethrough`.
- Foreground: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, and their `Bright` variants.
- Background: the corresponding `bg*` and `bg*Bright` functions.

Aliases, style chaining, advanced color modes, named factory aliases, and CommonJS exports are excluded.

The `spinlog/styles` subpath exports exactly the 38 style functions and the `Style` type. It omits the spinner runtime so style-only consumers receive the smallest tree-shakeable entrypoint.

## Factory And Defaults

`spinlog(text?, options?)` returns `Spinner`. Options are limited to `color`, `prefix`, `suffix`, and `spinner`. Defaults are empty text/prefix/suffix, cyan, dots, and an 80ms interval. Spinner names are exactly `dots` and `line`; spinner colors are the 16 foreground names.

The mutable instance properties are exactly `text`, `color`, `prefix`, and `suffix`. Lifecycle methods return the same instance for chaining and accept no undocumented parameters.

At runtime, invalid factory text, option objects, option values, terminal text overrides, and mutable assignments throw `TypeError` before output. A failed mutation preserves its previous value. Invalid promise options reject before spinner start, direct thenable observation, or task invocation. Unknown option keys are ignored for forward compatibility.

## Lifecycle

The internal states are `idle`, `spinning`, `stopped`, `succeeded`, `failed`, `warned`, and `informed`.

| Operation | Idle or stopped | Spinning | Terminal state |
| --- | --- | --- | --- |
| `start()` | Begin a new cycle | Idempotent no-op | Begin a new cycle |
| `stop()` | Enter/remain stopped without output | Clear, restore, and stop | Idempotent no-op |
| Terminal method | Persist the requested status once | Stop, restore, and persist once | Preserve the first terminal result |

Mutation never changes state and becomes visible on the next render. An optional terminal text argument replaces stored text before persistence. Rendering sanitizes user-controlled segments without changing their assigned property values. A new `start()` resets terminal idempotency for the next cycle. The per-method, per-source-state matrices in `specs/v1-behavior.json` are exhaustive; a destination or effect not listed there is illegal.

## Promise Wrapper

`spinlog.promise(...)` has exactly two generic overloads: a `PromiseLike<T>` input or a zero-argument function returning `PromiseLike<T>`. Both accept optional `PromiseOptions` and return `Promise<T>`.

The spinner starts before a direct input is observed or a callback is invoked. The callback runs once, thenables are assimilated, synchronous callback throws become rejections, and resolution calls `succeed` while rejection calls `fail`. The fulfillment value or original rejection reason is preserved. Cosmetic failures never replace action settlement.

## Terminal Degradation

Interactive rendering uses stderr and unreferenced timers. Non-interactive execution creates no timer and emits deterministic static start and terminal lines. An active synchronous write failure ends only that rendering cycle in `stopped`; terminal state and promise settlement remain logical outcomes rather than I/O outcomes. Style helpers remain side-effect-free and stream-free while using stderr capability only to decide whether ANSI is appropriate. Non-empty `NO_COLOR` and `NODE_DISABLE_COLORS` values outrank `FORCE_COLOR`; color forcing never enables animation.

## Explicitly Excluded From v1

The complete deferred list and rationale are in `specs/16_POST_MVP_FEATURES.md`. Phase 2 may not export task groups, progress, prompts, intro/outro helpers, structured logs, custom streams, custom animations, concurrent spinners, or advanced color APIs.
