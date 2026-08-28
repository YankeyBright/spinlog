# Migrating to spinlog 0.2

`spinlog@0.2.0` is the final pre-1.0 contract and intentionally breaks the unpublished 0.1.x / v1.1 design. spinlog is not API-compatible with Chalk, Ora, or Clack. Migrate behavior deliberately and retain unsupported features in the existing library until Spinlog defines a contract for them.

## From spinlog 0.1

The default remains `process.stderr`, but output is no longer stderr-global. Pass an explicit Node `Writable` with `stream` to spinner, group, progress, promise, intro, or outro calls. Explicit custom streams are now supported. One interactive surface is now allowed per writable identity, so independent streams can animate at the same time while same-target surfaces retain coordinated static fallback.

```js
import { PassThrough } from 'node:stream'

import spinlog from 'spinlog'

const stream = new PassThrough()
const spinner = spinlog('Generating', { stream, terminal: 'static' }).start()
spinner.succeed('Generated')
stream.end()
```

The new shared controls are `color: false`, `unicode`, `hideCursor`, and `indent` (0–40). They are target-local. `color: false` suppresses automatic frame and status color; `unicode: false` selects ASCII built-ins; `hideCursor: false` avoids cursor escape sequences. Spinlog still never patches `console`, arbitrary stream writes, or stdin.

Groups now enforce target height as well as width. Use `maxRows` to tighten the interactive budget; its default is `min(10, stream.rows - 1)`. If a group falls back to static output, stop and explicitly start a child again after conditions improve to begin a fresh eligible session. Permanently written or settled rows are not replayed by later sessions.

Progress defaults to a 20-cell bar, accepts `width: 5..40` and `style: 'blocks' | 'ascii'`, floors filled-cell calculation, rejects zero or negative increments, and completes to 100% on `succeed()`. The runtime `total` property is now backed by an immutable total getter.

`PromiseOptions<T>` adds `successText` and `failText`. Each accepts a string or a settlement callback. `intro()` and `outro()` now accept target, color, Unicode, and indentation options.

## From Chalk

Map supported named ANSI-16 colors, backgrounds, and modifiers to imports from `spinlog/styles`. Helpers are functions rather than chainable builders, so compose them explicitly.

<!-- example:migration-chalk:start -->
```js
import { bold, red } from 'spinlog/styles'

process.stderr.write(`${bold(red('Failed'))}\n`)
```
<!-- example:migration-chalk:end -->

There is no 0.2 equivalent for chaining, 256-color, truecolor, template parsing, or automatic stdout styling.

## From Ora

Map one spinner’s `start`, `stop`, `succeed`, `fail`, `warn`, `info`, and mutable text to the corresponding Spinlog instance behavior.

<!-- example:migration-ora:start -->
```js
import spinlog from 'spinlog'

const spinner = spinlog('Loading').start()
spinner.text = 'Loaded'
spinner.succeed()
```
<!-- example:migration-ora:end -->

Spinlog supports caller-defined frame sets and intervals, explicit custom writable streams, coordinated multi-row work through `spinlog.group()`, and determinate work through `spinlog.progress()`. It permits one interactive terminal surface per stream, not an unlimited set on one target. Use `spinner.log(message)` for a permanent line coordinated with the active Spinlog surface on that stream. Spinlog does not manage stdin or CommonJS loading.

## From Clack

Map independent introductory and closing flow lines to `spinlog.intro()` and `spinlog.outro()`.

<!-- example:migration-clack:start -->
```js
import spinlog from 'spinlog'

spinlog.intro('Setup')
spinlog.outro('Done')
```
<!-- example:migration-clack:end -->

Intro and outro calls are stateless and coordinate with an active Spinlog surface on their configured stream. They do not coordinate writes made directly by other libraries or by `console.error`. There is no 0.2 equivalent for prompts, cancellation orchestration, dashboard task logs, or stdin management.

## Stream and process differences

The default cosmetic target is `stderr`; an explicit stream is always application-supplied and application-owned. Style helpers return strings and never write. The package does not install signal handlers, terminate the process, or patch global output. Applications own shutdown policy and unrelated stream errors; while Spinlog has pending permanent output, it temporarily observes the target error so `flush()` rejects and its affected surface is cleaned up. Applications should call `stop()` on active spinners and groups during graceful shutdown.

For deterministic non-interactive output, use `static: 'symbol'`, `'text'`, or `'silent'`; use `terminal: 'static'` to force that path. `terminal: 'interactive'` is an informed override only for a non-dumb TTY. It does not waive conservative width checks or a group’s required height capacity.
