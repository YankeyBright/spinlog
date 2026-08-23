# spinlog

An ESM-only terminal style and spinner library with zero consumer runtime dependencies and an exact 4,096-byte gzip ceiling.

## Status

Phase 0 freezes the product contract. Phase 1 establishes the secure package shell. As frozen, the v1 runtime API begins in Phase 2, and the current implementation belongs to Phase 2. Phase 3 supplies reviewed benchmark and supply-chain evidence, while Phase 4 documentation is validated by repository gates. Publication is temporarily blocked while this terminal UX revision is revalidated; no version is currently authorized for npm release.

The normative v1 contracts are [`specs/v1-public-api.d.ts`](specs/v1-public-api.d.ts), [`specs/v1-styles-api.d.ts`](specs/v1-styles-api.d.ts), and [`specs/v1-behavior.json`](specs/v1-behavior.json).

## Runtime Support

spinlog supports Node.js `^22.13.0 || ^24.0.0 || ^26.0.0`. It is ESM-only and exposes the root `spinlog` entrypoint plus the style-only `spinlog/styles` subpath.

The source is compiled against ES2023, Node20 module semantics, and Node 22 type definitions. This prevents accidental use of Node 26-only APIs while compatibility is tested across Node 22, 24, and 26.

## Spinner

`spinlog(text?, options?)` returns a mutable spinner. Options are `color`, `prefix`, `suffix`, `spinner`, `static`, and `terminal`; built-in animations are `dots` and `line`.

<!-- example:spinner:start -->
```js
import spinlog from 'spinlog'

const spinner = spinlog('Building', {
  color: 'cyan',
  prefix: 'build',
  spinner: 'dots',
}).start()

spinner.text = 'Bundling'
spinner.log('Writing manifest')
spinner.succeed('Built')
```
<!-- example:spinner:end -->

Mutable fields are exactly `text`, `color`, `prefix`, and `suffix`. Lifecycle methods are `start()`, `stop()`, `succeed()`, `fail()`, `warn()`, and `info()`; every method returns the same instance.

`spinner.log(message)` writes one sanitized permanent line to `stderr` and returns the same instance. When that instance or another Spinlog spinner owns the interactive line, the line is inserted above the frame and the frame is redrawn in the same write. It never changes the spinner text, state, timer, or cursor ownership.

`start()` is idempotent while active. The first terminal result in a cycle wins, and a later terminal call is an idempotent no-op after its optional text argument has been validated. Calling `start()` after a terminal result begins a new cycle.

## Promise Wrapper

`spinlog.promise(input, options?)` accepts a `PromiseLike<T>` or a zero-argument task returning one. It starts before observing or invoking the input, settles the spinner cosmetically, and preserves the exact fulfillment value or rejection reason.

<!-- example:promise:start -->
```js
import spinlog from 'spinlog'

const artifact = await spinlog.promise(() => Promise.resolve('dist/index.js'), {
  text: 'Building package',
})

if (artifact !== 'dist/index.js') throw new Error('unexpected artifact')
```
<!-- example:promise:end -->

## Intro And Outro

`spinlog.intro(message?)` and `spinlog.outro(message?)` synchronously write independent flow lines to `stderr` and return `void`.

<!-- example:flow:start -->
```js
import spinlog from 'spinlog'

spinlog.intro('Deployment')
const spinner = spinlog('Verifying').start()
spinner.succeed()
spinlog.outro('Complete')
```
<!-- example:flow:end -->

Unicode output uses U+250C for intro and U+2514 for outro, followed by two spaces and the message; unsupported Windows terminals use `>  Message` and `<  Message`. Empty messages produce marker-only lines. Calls do not pair or create timers. During interactive animation, a flow line is inserted above the active frame and that frame is redrawn atomically.

## Styles

The package exposes 38 ANSI-16 style functions. Import them from the root with the spinner or from `spinlog/styles` when only styles are needed.

<!-- example:styles:start -->
```js
import { bold, green } from 'spinlog/styles'

process.stderr.write(`${bold(green('Ready'))}\n`)
```
<!-- example:styles:end -->

Styles validate string input, return a string, write no stream, and restore enclosing nested styles. `reset` is a hard reset boundary. The named surface includes six modifiers, 16 foreground colors, and 16 background colors.

## Terminal Policy

Spinner and flow output goes only to `stderr`; the library never writes to `stdout`. Non-interactive use emits deterministic static lines without timers or cursor controls. `static` defaults to `'symbol'`, preserving the frame line at start and the colored status line at settlement. `'text'` writes two unstyled sanitized text lines without a frame or status symbol, and `'silent'` suppresses automatic static start and settlement lines while leaving `spinner.log(message)` available. The library permits one interactive spinner at a time; later spinners use their configured static behavior until explicitly restarted. Animation is also disabled when stderr width is unknown, narrow, or conservatively too small for a single frame.

Interactive timers are unreferenced. `stop()`, terminal methods, and the `Symbol.dispose` method (`spinner[Symbol.dispose]()`) restore the cursor on explicit cleanup. `using spinner = spinlog('Work').start()` provides block-scoped cleanup on supported Node runtimes. Signals, forced termination, and other abrupt shutdown paths remain application-owned.

`terminal` defaults to `'auto'`. In automatic mode, cursor animation requires a TTY, usable width, and a conservative recognized terminal profile; unknown profiles, `vt100`, `vt220`, empty `TERM`, CI, test mode, `TERM=dumb`, and non-TTY stderr use the configured static behavior. `'static'` always disables animation and cursor control. `'interactive'` is an informed caller override that permits animation for any TTY except `TERM=dumb`, including CI and test environments; it never enables color by itself.

SGR, cursor control, color, emphasis, animation, and Unicode are resolved independently. Color precedence is `NO_COLOR`, `NODE_DISABLE_COLORS`, `FORCE_COLOR`, `CI`, `TERM=dumb`, `NODE_ENV=test`, stderr TTY detection, then the recognized terminal profile. Explicit disable variables outrank `FORCE_COLOR`, and forced color never forces animation. `NO_COLOR` and `NODE_DISABLE_COLORS` disable colors only; explicitly requested emphasis such as bold or underline remains available on a known capable interactive stderr terminal. CI, dumb terminals, test mode, and non-TTY stderr remain plain by default.

User-controlled terminal text is sanitized lazily at the render boundary. ANSI, OSC, C0/C1 controls, bidi controls, and line separators cannot create extra terminal lines. Assigned spinner values remain unchanged; sanitized text and conservative width are cached until text, prefix, or suffix changes.

Synchronous cosmetic write failures are contained and backpressure returns are ignored. Asynchronous stream errors, signals, shutdown, and process termination remain application-owned. The library installs no process signal listeners and never terminates the host process. Intro, outro, and `spinner.log()` calls coordinate with an active spinlog frame; unrelated `stderr` or `console.error` writes remain application-owned and can interleave, so applications should use `spinner.log()` or settle a spinner before their own permanent output.

ANSI transcripts are replayed through a headless terminal emulator in automated tests. This is protocol evidence rather than a universal physical-terminal claim; contributors manually smoke-test Windows Terminal, macOS Terminal or iTerm, and a mainstream Linux terminal before a release candidate.

## Migration

See [`MIGRATION.md`](MIGRATION.md) for behavior-based guidance from Chalk, Ora, and Clack. spinlog is not API-compatible with those packages, and v1 intentionally excludes custom streams, custom animations, concurrent spinners, advanced colors, prompts, progress bars, task groups, and structured logs.

## Package Evidence

- Zero runtime, optional, and peer dependencies.
- No npm lifecycle scripts.
- Exactly eleven files in the npm tarball.
- `dist/index.js` currently measures 3,860 bytes using gzip level 9, below the 4,096-byte hard ceiling.
- A one-style `spinlog/styles` consumer measures 593 gzip bytes against a 600-byte tree-shaking ceiling.
- A canonical CycloneDX 1.5 runtime SBOM with zero runtime components is included in the tarball.
- Build-tool SBOM, benchmark, reproducibility, and candidate-manifest evidence remain outside the tarball.
- The temporary release-revalidation workflow is manual, read-only, and cannot publish, attest, authenticate to npm, or create a GitHub release.
- Publication is temporarily blocked pending a new reviewed release policy. A future preview must use the HTTPS npm registry and must never publish `latest` without a separate contract revision.

These controls reduce defined risks. They are not a security certification, provenance claim, SLSA claim, or guarantee of zero risk.

## Verification

Full contributor tooling uses Node 22.18.0 or later on the Node 22 line because of development-tool engine requirements. Runtime-floor compatibility at Node 22.13.0 is tested only through the packed package.

```bash
npm ci --ignore-scripts
npm run check:foundation
npm run check:phase3
npm run check:phase4
npm run check:phase5
npm run check:phases
npm audit --audit-level=low
```

The final aggregate is fail-fast and emits this only after all Phase 0 through Phase 4 gates pass:

```json
{"phase0":"pass","phase1":"pass","phase1Release":"pass","phase2":"pass","phase3":"pass","phase4":"pass"}
```

`npm run check:phase5` validates the static trusted-release policy separately and reports `phase5=hold` while publication is blocked. Terminal UX hardening changed runtime, build, dependency, package, and benchmark inputs after the former preview receipt. It therefore cannot be used for publication. A new reviewed five-run Node 24 Linux baseline and fresh Phase 3/4 evidence are required before a new release policy can be approved. Baseline collection uses `check:foundation` to avoid circularly accepting its own evidence.

## Security

Report vulnerabilities privately through the [GitHub Security Advisory form](https://github.com/YankeyBright/spinlog/security/advisories/new). See [`SECURITY.md`](SECURITY.md) for response and support policy.

## License

[MIT](LICENSE)
