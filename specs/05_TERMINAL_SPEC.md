# Terminal Protocol

`specs/v1-behavior.json` is normative for terminal behavior. Phase 2 must implement it without external runtime packages.

## ANSI Styles

Use Select Graphic Rendition sequences in the form `\x1b[<code>m`.

- Foreground: 30-37 and bright foreground 90-97.
- Background: 40-47 and bright background 100-107.
- Modifiers: reset 0, bold 1/22, dim 2/22, italic 3/23, underline 4/24, and strikethrough 9/29.
- Default foreground and background restoration: 39 and 49.

Nested styles must restore the enclosing opening sequence instead of leaking the terminal default. For example, the outer red style in `red('a ' + blue('b') + ' c')` remains active for ` c`.

Style helpers are pure `(text: string) => string` functions. They never select or write a stream.

## Cursor And Line Control

- Hide cursor: `\x1b[?25l`
- Show cursor: `\x1b[?25h`
- Clear active line: `\x1b[2K\r`

Interactive animation renders immediately, then advances every 80ms. The dots frame code points are `\u280b`, `\u2819`, `\u2839`, `\u2838`, `\u283c`, `\u2834`, `\u2826`, `\u2827`, `\u2807`, and `\u280f`. The line frames are `-`, `\\`, `|`, and `/`.

The status symbols are `\u2714`, `\u2716`, `\u26a0`, and `\u2139`, with ASCII fallbacks `+`, `x`, `!`, and `i`. Success, failure, warning, and information symbols use green, red, yellow, and blue respectively. Color applies only to the symbol. Empty segments are omitted; remaining prefix, symbol, text, and suffix segments are joined in that order with one ASCII space.

Interactive `start()` hides the cursor and renders the first frame synchronously. Each subsequent frame clears the active line before rendering without a newline. `stop()` clears the line and restores the cursor. A terminal method clears the line, writes one newline-terminated status, and restores the cursor. Non-interactive `start()` writes one newline-terminated static frame; `stop()` writes nothing; a terminal method writes one newline-terminated status. Non-interactive execution never creates a timer or emits cursor-control sequences.

## Capability Policy

Color and animation are separate decisions.

1. `FORCE_COLOR=0` or `FORCE_COLOR=false` disables color.
2. Any other defined `FORCE_COLOR` value enables ANSI-16 color and overrides color-disable environment variables.
3. Without `FORCE_COLOR`, a non-empty `NO_COLOR` or `NODE_DISABLE_COLORS` disables color.
4. Without an override, CI, `TERM=dumb`, `NODE_ENV=test`, or non-TTY stderr disables color.
5. Animation is disabled for CI, dumb terminals, test execution, and non-TTY stderr regardless of color forcing.

On Windows, the dots spinner uses its line fallback unless `WT_SESSION` indicates Windows Terminal. No browser fallback is provided because v1 is Node-only.

## Streams And Process Ownership

- Spinner frames, static fallback lines, and statuses write only to `stderr`.
- The package never writes to `stdout`.
- Interactive animation hides the cursor and every explicit stop or terminal transition restores it in cleanup.
- The library installs no process signal or exit listener and never terminates the host process.
- Applications own abrupt shutdown and may call `stop()` from their own shutdown policy.
- Concurrent active spinners and custom streams are unsupported in v1.

Synchronous write failures are caught around each cosmetic write. The active timer is cleared, cursor restoration is attempted, and promise results remain unchanged. Asynchronous host-stream error policy remains application-owned.
