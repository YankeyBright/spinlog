# spinlog

An ESM-only terminal feedback library with zero consumer runtime dependencies and an exact 10,240-byte gzip ceiling.

## Status

This is the final pre-1.0 API redesign: `spinlog@0.2.0`. It intentionally includes breaking changes from 0.1.x, documented in [MIGRATION.md](MIGRATION.md). Publication remains blocked on the `next` tag until the full verification and release-evidence sequence is reviewed.

The normative contracts are [specs/v1-public-api.d.ts](specs/v1-public-api.d.ts), [specs/v1-styles-api.d.ts](specs/v1-styles-api.d.ts), and [specs/v1-behavior.json](specs/v1-behavior.json).

## Runtime support

spinlog supports Node.js `^22.13.0 || ^24.0.0 || ^26.0.0`. It is ESM-only and exposes the root `spinlog` entrypoint plus the style-only `spinlog/styles` subpath.

## Spinner

`spinlog(text?, options?)` returns a mutable spinner. Built-in animations are `dots` and `line`; `spinner` may also be a snapshotted definition with one to 64 visible frames and an optional 16ms–60,000ms interval.

<!-- example:spinner:start -->
```js
import spinlog from 'spinlog'

const spinner = spinlog('Building', {
  color: 'cyan',
  indent: 2,
  prefix: 'build',
  spinner: 'dots',
}).start()

spinner.text = 'Bundling'
spinner.log('Writing manifest')
spinner.succeed('Built')
```
<!-- example:spinner:end -->

Mutable fields are exactly `text`, `color`, `prefix`, and `suffix`. Lifecycle methods are `start()`, `stop()`, `succeed()`, `fail()`, `warn()`, and `info()`; each returns the same instance. `start()` is idempotent while active. The first terminal result in a cycle wins, and a later terminal call is an idempotent no-op after its optional text has been validated.

`spinner.log(message)` writes one sanitized permanent line to the spinner’s configured target and returns the same instance. When a Spinlog surface owns that target’s interactive frame, the line is placed above the frame and the frame is redrawn. It never changes spinner state, timers, or cursor ownership.

`spinner.flush()` returns a promise that resolves when already-accepted permanent output for its target has drained. `group.flush()`, `progress.flush()`, and `spinlog.flush(options?)` provide the same explicit durability boundary. It does not take ownership of application writes made directly to the stream.

## Render targets and controls

Spinner, group, progress, promise, and flow calls accept an explicit `stream?: Writable`; the default is `process.stderr`. Spinlog never patches `console`, `process.stderr.write`, or any arbitrary stream method. Direct writes remain application-owned and may interleave; use the instance `log()` method or flow methods for coordinated lines on a target.

TypeScript projects using `stream` should make the normal Node declarations available (for example, `@types/node` when their toolchain does not already provide them).

| Option | Default | Contract |
| --- | --- | --- |
| `stream` | `process.stderr` | A Node writable target. One interactive surface is allowed per writable identity. |
| `color` | `'cyan'` | A named ANSI-16 frame color, or `false` to disable all automatic color for that surface, including status symbols. |
| `unicode` | `'auto'` | `false` forces ASCII built-ins and progress bars; custom frame text remains caller supplied and sanitized. |
| `hideCursor` | `true` | Set `false` to leave cursor visibility untouched during an interactive cycle. |
| `indent` | `0` | Leading spaces on every generated line; a safe integer from 0 through 40. |
| `static` | `'symbol'` | Static fallback: `'symbol'`, `'text'`, or `'silent'`. |
| `terminal` | `'auto'` | `'auto'`, `'static'`, or the informed `'interactive'` override. |

<!-- example:custom-stream:start -->
```js
import { PassThrough } from 'node:stream'

import spinlog from 'spinlog'

// Stream ownership stays with the application. This target is deliberately
// non-TTY, so it demonstrates deterministic static output as well.
const output = new PassThrough()
output.pipe(process.stderr, { end: false })

const spinner = spinlog('Writing report', {
  color: false,
  stream: output,
  terminal: 'static',
  unicode: false,
}).start()

spinner.succeed('Report written')
output.end()
```
<!-- example:custom-stream:end -->

Independent writable streams may animate independently. On the same stream, a later root surface follows its configured static behavior until it is explicitly restarted after the earlier surface releases its lease. A group counts as one multi-row surface.

## Custom frames

<!-- example:custom-spinner:start -->
```js
import spinlog from 'spinlog'

const spinner = spinlog('Deploying', {
  color: false,
  spinner: { frames: ['.', 'o', 'O', 'o'], interval: 100 },
  unicode: false,
}).start()

spinner.succeed('Deployed')
```
<!-- example:custom-spinner:end -->

Definitions are copied before rendering. A one-frame definition deliberately uses static output and creates no timer. Frame text is sanitized only at the terminal boundary, like spinner text.

## Promise wrapper

`spinlog.promise(input, options?)` accepts a `PromiseLike<T>` or a zero-argument task returning one. It starts before observing or invoking the input, settles cosmetically, and preserves the exact fulfillment value or rejection reason. `successText` and `failText` accept a string or a callback that derives the terminal text from the settled value or error.

<!-- example:promise:start -->
```js
import spinlog from 'spinlog'

const artifact = await spinlog.promise(() => Promise.resolve('dist/index.js'), {
  text: 'Building package',
  successText: (path) => `Built ${path}`,
  failText: (error) => `Build failed: ${String(error)}`,
})

if (artifact !== 'dist/index.js') throw new Error('unexpected artifact')
```
<!-- example:promise:end -->

## Intro and outro

`spinlog.intro(message?, options?)` and `spinlog.outro(message?, options?)` synchronously write stateless flow lines and return `void`. Flow options support `stream`, `color`, `unicode`, and `indent` because they never own an interactive cursor lease.

<!-- example:flow:start -->
```js
import spinlog from 'spinlog'

const output = { color: false, indent: 2, unicode: false }

spinlog.intro('Deployment', output)
const spinner = spinlog('Verifying', output).start()
spinner.succeed()
spinlog.outro('Complete', output)
```
<!-- example:flow:end -->

## Groups

`spinlog.group(options?)` creates one coordinated multi-row surface on its target. `group.add()` returns an idle child spinner; children inherit the group target, static mode, terminal policy, Unicode policy, cursor policy, and indentation. Child options may set their own frame color, prefix, suffix, and frame set.

<!-- example:group:start -->
```js
import spinlog from 'spinlog'

const group = spinlog.group({ indent: 2, maxRows: 4 })
const install = group.add('Installing packages').start()
const build = group.add('Building assets').start()

install.succeed('Installed')
build.succeed('Built')
group.stop()
```
<!-- example:group:end -->

`maxRows` must be a positive safe integer. Its default is `min(10, stream.rows - 1)`. Groups use static output when target rows are unavailable or active rows exceed that budget. A width or height loss demotes the complete group atomically. Settled and static rows are persisted; a later child start never redraws permanent history. A child that started static stays static until explicitly stopped and restarted; once a session has no active rows, its lease session is idle and a later restart can acquire a lease again.

Groups do not nest or dynamically reorder rows.

## Progress

`spinlog.progress(text, { total, value?, width?, style?, ...options })` creates a determinate, timer-free indicator. Its callable signature is `spinlog.progress(text, options)`. `total` is a positive safe integer and immutable at runtime. Values are safe integers from zero through `total`; `update()` replaces the value and `increment()` accepts only a positive safe integer.

<!-- example:progress:start -->
```js
import spinlog from 'spinlog'

const progress = spinlog
  .progress('Uploading', {
    total: 3,
    style: 'blocks',
    width: 20,
  })
  .start()
progress.increment()
progress.update(2)
progress.succeed('Uploaded')
```
<!-- example:progress:end -->

`width` is a safe integer from 5 through 40 and defaults to 20. `style` is `'blocks'` by default or `'ascii'`; block bars automatically fall back to ASCII when Unicode is unavailable. Filled cells use `Math.floor()`, so a frame never claims more completion than its exact value. `succeed()` completes the value to 100% before it renders; `fail()`, `warn()`, and `info()` retain the actual value.

## Terminal policy

spinlog never writes to `stdout` by default and never manages stdin. It installs no process signal listeners, never terminates the host process, and does not own asynchronous stream errors. Applications own shutdown and should call `stop()` on active surfaces during graceful shutdown.

In automatic mode, interactive animation requires a target TTY, a conservative recognized terminal profile, usable width, and—only for groups—known usable height. `terminal: 'interactive'` remains an informed override for a non-dumb TTY, but it does not bypass group height safety. Non-interactive surfaces produce deterministic static output with no timer or cursor control.

`static` defaults to `'symbol'` and `terminal` defaults to `'auto'`. `'text'` writes unstyled sanitized text, and `'silent'` suppresses automatic static start and settlement lines while leaving explicit logs available. Every interactive lease is target-local. `unicode: false` forces ASCII built-ins, and `hideCursor: false` suppresses both cursor-hide and cursor-show escapes for that surface. The `Symbol.dispose` method provides explicit block-scoped cleanup.

`NO_COLOR`, `NODE_DISABLE_COLORS`, and `FORCE_COLOR` retain their precedence. `FORCE_COLOR` enables ANSI SGR (including emphasis) but never enables cursor animation. `color: false` is an explicit surface-level override that disables automatic color even if terminal capability and environment variables allow it.

User-controlled terminal text is sanitized lazily at the render boundary. ANSI, OSC, C0/C1 controls, bidi controls, and line separators cannot create extra terminal lines. Assigned spinner values remain unchanged; sanitized text and grapheme-aware terminal width are cached until text, prefix, or suffix changes. Combining sequences occupy their base width, East Asian wide/full-width and emoji clusters occupy two cells, and custom frames are measured in full.

Synchronous cosmetic write failures are contained to the affected surface and restore a cursor it owns. A `Writable.write()` result of `false` is backpressure rather than failure: no later bytes are written to that target until `drain`, permanent lines retain order, and the latest cosmetic redraw is coalesced. Ready targets attempt a permanent write before applying backlog limits; only pending output is bounded to 64 tasks or 64 KiB. Temporary `drain`, `finish`, and `close` listeners settle or reject `flush()` and are removed on every completion path, so an ended target cannot leave a flush pending indefinitely.

## Styles

The package exposes 38 ANSI-16 style functions. Import them from the root with the spinner or from `spinlog/styles` when only styles are needed.

<!-- example:styles:start -->
```js
import { bold, green } from 'spinlog/styles'

process.stderr.write(`${bold(green('Ready'))}\n`)
```
<!-- example:styles:end -->

Styles validate string input, return a string, write no stream, and restore enclosing nested styles. `reset` is a hard reset boundary. The style entrypoint remains capability-aware using the default stderr target; it does not claim ownership of custom render targets.

## Migration

See [MIGRATION.md](MIGRATION.md) for migration from 0.1.x, Chalk, Ora, and Clack. spinlog is not API-compatible with those packages. This release intentionally excludes truecolor, themes, ETA/rate, prompts, structured task logs, global write interception, stdin handling, CommonJS, and browser-first runtime support.

## Package evidence

- Zero runtime, optional, and peer dependencies.
- No npm lifecycle scripts.
- Exactly eleven files in the npm tarball.
- `dist/index.js` currently measures 9,897 bytes using gzip level 9, below the 10,240-byte hard ceiling.
- A one-style `spinlog/styles` consumer remains constrained by a 768-byte tree-shaking ceiling.
- A canonical CycloneDX 1.5 runtime SBOM with zero runtime components is included in the tarball.
- Publication is temporarily blocked pending refreshed runtime, terminal, package, SBOM, benchmark, and documentation evidence for the `0.2.0` pre-1.0 contract.

These controls reduce defined risks. They are not a security certification, provenance claim, SLSA claim, or guarantee of zero risk.

## Verification

Full contributor tooling uses Node 22.18.0 or later on the Node 22 line because of development-tool engine requirements. Runtime-floor compatibility at Node 22.13.0 is tested through the packed package.

```bash
npm ci --ignore-scripts
npm run format:check
npm run lint
npm run typecheck
npm run typecheck:contracts
npm run api:check
npm test
npm run test:stability
npm run check:phase4
npm run check:phase5
```

Release acceptance additionally requires package checks, size checks, terminal-emulation and cross-platform TTY-target smoke coverage, and three consecutive full green test runs. `npm run check:phase5` validates the static trusted-release policy separately and reports `phase5=hold` while publication is blocked.

## Security

Report vulnerabilities privately through the [GitHub Security Advisory form](https://github.com/YankeyBright/spinlog/security/advisories/new). See [SECURITY.md](SECURITY.md) for response and support policy.

## License

[MIT](LICENSE)
