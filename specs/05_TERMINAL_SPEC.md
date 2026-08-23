# Terminal Protocol

`specs/v1-behavior.json` is normative for terminal behavior. Phase 2 must implement it without external runtime packages.

## ANSI Styles

Use Select Graphic Rendition sequences in the form `\x1b[<code>m`.

- Foreground: 30-37 and bright foreground 90-97.
- Background: 40-47 and bright background 100-107.
- Modifiers: reset 0, bold 1/22, dim 2/22, italic 3/23, underline 4/24, and strikethrough 9/29.
- Default foreground and background restoration: 39 and 49.

Nested non-reset styles must restore the enclosing opening sequence instead of leaking the terminal default. For example, the outer red style in `red('a ' + blue('b') + ' c')` remains active for ` c`. `reset` is a hard SGR boundary: it resets all active attributes and does not reopen an enclosing style.

Style helpers are side-effect-free `(text: string) => string` functions. They read named stderr capabilities: foreground/background helpers require color, while `reset` and modifiers require emphasis. ANSI metadata defines every opening code, closing code, category, spinner-eligible foreground, and nesting-restoration strategy. Helpers never write to a stream. Invalid JavaScript input throws `TypeError` before capability detection.

## Cursor And Line Control

- Hide cursor: `\x1b[?25l`
- Show cursor: `\x1b[?25h`
- Clear active line: `\x1b[2K\r`

Interactive animation renders immediately, then advances every 80ms. Its interval is unreferenced so cosmetic rendering cannot keep the host process alive. The dots frame code points are `\u280b`, `\u2819`, `\u2839`, `\u2838`, `\u283c`, `\u2834`, `\u2826`, `\u2827`, `\u2807`, and `\u280f`. The line frames are `-`, `\\`, `|`, and `/`.

The status symbols are `\u2714`, `\u2716`, `\u26a0`, and `\u2139`, with ASCII fallbacks `+`, `x`, `!`, and `i`. Success, failure, warning, and information symbols use green, red, yellow, and blue respectively. Spinner color applies only to the active frame; status color applies only to the status symbol. Empty segments are omitted; remaining prefix, symbol, text, and suffix segments are joined in that order with one ASCII space.

User-controlled `text`, `prefix`, `suffix`, and terminal text overrides are sanitized only when rendered. The renderer uses Node's `stripVTControlCharacters`, replaces each remaining run of C0/C1 controls, Arabic Letter Mark, left-to-right/right-to-left marks, Unicode line separators, bidi embeddings/overrides, and bidi isolates with one ASCII space, then trims segment boundaries. The exact ranges are frozen in `specs/v1-behavior.json`. Assigned values remain unchanged. Embedded ANSI styling is therefore removed from spinner fields; the spinner `color` option is the only v1 styling control for frames. An immutable sanitized snapshot and conservative cell width are created lazily at the rendering boundary, invalidated only by `text`, `prefix`, or `suffix` mutation, and reused by color-only updates and subsequent frames.

## Intro And Outro

`spinlog.intro(message?)` writes `┌  Message\n`; `spinlog.outro(message?)` writes `└  Message\n`. When Unicode is unavailable, their markers are `>` and `<`. An empty or omitted message emits only the marker and newline. Each call is synchronous, repeatable, and performs exactly one `stderr.write`. Calls need not be paired and never create timers. When a spinner owns the interactive line, a flow call clears that line, writes the flow line, and redraws the active frame in its one write.

The optional message must be a string. Validation occurs before capability detection or output. The message uses the same render-boundary sanitization as spinner text, including removal of ANSI and terminal controls. When color is enabled, only the marker receives `blackBright`; message text is never colored. Synchronous write exceptions are suppressed and backpressure returns are ignored. Asynchronous stream errors remain host-owned.

Interactive `start()` hides the cursor and renders the first frame synchronously. Each subsequent frame clears the active line before rendering without a newline. Exactly one spinner may hold this process-local lease. Later spinners write newline-terminated static lines and do not create timers or cursor sequences. `stop()` clears the owned line and restores the cursor. A terminal method clears the owned line, writes one newline-terminated status, and restores the cursor. `Spinner[Symbol.dispose]()` is equivalent to `stop()` for block-scoped cleanup.

Animation requires a positive `stderr.columns` value of at least three and a conservatively measured unstyled frame width strictly below `columns - 1`. ASCII scalars count as one terminal cell and every non-ASCII scalar counts as two. Unknown, narrow, resized, or mutation-overflowing terminal widths demote the spinner to a newline-terminated static line after clearing its frame and restoring the cursor. This intentionally favors safe degradation over inaccurate Unicode width guesses.

## Capability Policy

SGR, cursor control, color, emphasis, animation, and Unicode are separate named capability decisions. SGR and cursor control require a conservative recognized terminal profile in automatic mode; a TTY alone is not feature proof.

Precedence is listed from highest to lowest:

1. A non-empty `NO_COLOR` disables foreground/background color, including when `FORCE_COLOR` is defined.
2. A non-empty `NODE_DISABLE_COLORS` disables foreground/background color, including when `FORCE_COLOR` is defined.
3. `FORCE_COLOR=0` or `FORCE_COLOR=false` disables color; any other defined value enables ANSI-16 color.
4. Without an explicit color request, a non-empty `CI`, exact `TERM=dumb`, exact `NODE_ENV=test`, non-TTY stderr, an unknown profile, or an empty `TERM` disables color.
5. In `terminal: 'auto'`, animation requires a TTY plus one of `xterm`, `screen`, `tmux`, `rxvt`, `linux`, `cygwin`, `st`, `alacritty`, `kitty`, `wezterm`, `foot`, `konsole`, `vte`, `eterm`, or `putty`, matched as an ASCII-lowercase exact name or with a `-` suffix. `vt100` and `vt220` are static by default. Windows Terminal is recognized through `WT_SESSION`.
6. `terminal: 'static'` disables animation and cursor control. `terminal: 'interactive'` permits animation for any TTY except `TERM=dumb`, including CI and test environments, but never enables color by itself.

On a recognized interactive stderr terminal, explicit `reset`, `bold`, `dim`, `italic`, `underline`, and `strikethrough` remain available when color is disabled. CI, dumb terminals, test execution, non-TTY stderr, and unknown profiles suppress emphasis by default. Explicit color forcing may enable color on an unknown profile but does not make it emphasis-capable. Spinner frames, statuses, and flow markers are color-only and remain unstyled when color is disabled.

This is spinlog's frozen product policy. It deliberately gives explicit color-disable variables priority because v1 exposes no per-call capability override.

On Windows, the dots spinner uses its line fallback unless `WT_SESSION` indicates Windows Terminal. No browser fallback is provided because v1 is Node-only.

## Streams And Process Ownership

- Spinner frames, static fallback lines, statuses, intro messages, and outro messages write only to `stderr`.
- The package never writes to `stdout`.
- Interactive animation hides the cursor and every explicit stop, terminal transition, or disposal restores it in cleanup.
- The library installs no process signal or exit listener and never terminates the host process.
- Applications own abrupt shutdown and may call `stop()` from their own shutdown policy.
- Only spinlog's own flow messages and spinner.log() writes coordinate with an active frame; unrelated `stderr` or `console.error` writes remain host-owned and may interleave.
- `spinner.log(message)` validates and sanitizes a string before effects, writes one permanent newline-terminated `stderr` line, returns the instance, and never changes state, timer ownership, or cursor ownership. With an active lease, it clears, writes, and redraws in one write.
- Applications should use `spinner.log()` or settle active spinners with a terminal method, `stop()`, `Symbol.dispose`, or `try`/`finally` before their own permanent output.
- Multi-row concurrent animation and custom streams are unsupported in v1.

## Static Modes

`static` defaults to `'symbol'`. It preserves the ordinary static frame line on `start()` and status line on terminal settlement. `'text'` writes a sanitized unstyled prefix/text/suffix line at both points, with no frame or status symbol. `'silent'` suppresses only automatic static start and terminal output; explicit `spinner.log()` remains visible. These modes apply to non-interactive execution, an unavailable lease, `terminal: 'static'`, and width demotion. A demoted silent spinner still restores its cursor ownership.

Synchronous write failures are caught around each cosmetic write. A failure during active rendering clears the timer, attempts cursor restoration, moves that cycle to `stopped`, and permits a later `start()` retry. A failure during a terminal transition preserves the requested terminal state. Cleanup failures are suppressed, a `false` backpressure return is not an error, and promise results remain unchanged. Asynchronous host-stream error policy remains application-owned.
