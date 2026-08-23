# Migrating To spinlog

spinlog is not API-compatible with Chalk, Ora, or Clack. Migrate behavior deliberately and keep unsupported features in the existing library until they have a frozen spinlog contract.

## From Chalk

Map supported named ANSI-16 colors, backgrounds, and modifiers to imports from `spinlog/styles`. Helpers are functions rather than chainable builders, so compose them explicitly.

<!-- example:migration-chalk:start -->
```js
import { bold, red } from 'spinlog/styles'

process.stderr.write(`${bold(red('Failed'))}\n`)
```
<!-- example:migration-chalk:end -->

There is no v1 equivalent for chaining, 256-color, truecolor, template parsing, or automatic stdout styling.

## From Ora

Map one spinner's `start`, `stop`, `succeed`, `fail`, `warn`, `info`, and mutable text to the corresponding spinlog instance behavior.

<!-- example:migration-ora:start -->
```js
import spinlog from 'spinlog'

const spinner = spinlog('Loading').start()
spinner.text = 'Loaded'
spinner.succeed()
```
<!-- example:migration-ora:end -->

There is no v1 equivalent for custom streams, custom frame sets, custom intervals, multi-row concurrent animation, or CommonJS loading. Spinlog permits one interactive spinner and renders later simultaneous spinners with their configured static behavior. Use `spinner.log(message)` for a permanent line that coordinates with Spinlog's active frame.

## From Clack

Map independent introductory and closing flow lines to `spinlog.intro()` and `spinlog.outro()`.

<!-- example:migration-clack:start -->
```js
import spinlog from 'spinlog'

spinlog.intro('Setup')
spinlog.outro('Done')
```
<!-- example:migration-clack:end -->

Intro and outro calls are stateless and coordinate with an active Spinlog frame. They do not coordinate writes made directly by other libraries or by `console.error`. There is no v1 equivalent for prompts, task groups, progress bars, cancellation orchestration, or custom output streams.

## Stream And Process Differences

spinlog writes cosmetic runtime output only to `stderr`. Style helpers return strings and never write. The package does not install signal handlers, terminate the process, or own asynchronous stream errors. Applications remain responsible for shutdown policy and should call `stop()` on active spinners during graceful shutdown. For deterministic non-interactive output, use `static: 'symbol'`, `'text'`, or `'silent'`; use `terminal: 'static'` to force that path, or the informed `terminal: 'interactive'` override only for a TTY that supports cursor control.
