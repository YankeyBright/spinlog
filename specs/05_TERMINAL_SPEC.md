# Terminal Protocol & Implementation Foundations

You must implement directly without external libs.

## 1. SGR - Select Graphic Rendition
Format: `\x1b[<code>m`

Constants to hardcode:
- Foreground 30-37: black, red, green, yellow, blue, magenta, cyan, white
- Bright 90-97: bright variants
- Background 40-47: bgBlack, bgRed, bgGreen, bgYellow, bgBlue, bgMagenta, bgCyan, bgWhite
- Bright background 100-107: bright bg variants
- Modifiers: 1=bold (reset 22), 2=dim (reset 22), 3=italic (reset 23), 4=underline (reset 24), 9=strikethrough (reset 29), 0=reset all
- Restore: `\x1b[39m` = default fg, `\x1b[49m` = default bg, `\x1b[0m` = full reset

**Nested Closure Handling:**
Problem: `red('a ' + blue('b') + ' c')` must not bleed.
Solution: On format, replace inner closing sequences with parent opening sequence.
Implementation: When wrapping string, detect `\x1b[39m` or `\x1b[0m` inside and replace with opening code.

Avoid regex per call if possible - use fast string replace.

## 2. Cursor Control
- Hide: `\x1b[?25l`
- Show: `\x1b[?25h`
- Clear line: `\x1b[2K\r` or `\r\x1b[K`

Animation loop:
- Interval: 80ms (neurological cadence expected from ora)
- Each tick: clear line, write frame + text to stderr
- Frames: Unicode braille (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏) if unicode supported, else ASCII (`-\|/`)

## 3. Environment Detection (create env.ts)
Check order matters:
1. `process.env.NO_COLOR` - if set and not empty string -> disable all ANSI
2. `process.env.FORCE_COLOR` - if set -> force color even if non-TTY
3. `process.stderr.isTTY` - if false -> non-TTY mode
4. `process.env.CI` or `process.env.TERM === 'dumb'` or `process.env.NODE_ENV === 'test'` -> CI mode

In non-TTY/CI: disable animation interval, emit static text only. Prevents flooding logs with ANSI frames.

Defensive: Wrap all `process` access in try/catch + `typeof process !== 'undefined'` check for browser sandbox safety. Degrade to no-op if process undefined.

Unicode detection heuristic: Check if `process.platform !== 'win32'` or if `process.env.WT_SESSION` is set (Windows Terminal supports Unicode).

## 4. Stream Routing & Signal Trap
- All cosmetic -> `process.stderr` (fd 2)
- Keep `stdout` clean for JSON piping

Signal Handling (singleton module `signal.ts`):
- Must trap SIGINT and SIGTERM once (prevent multiple listeners)
- On SIGINT (2) -> exit 130 (128+2)
- On SIGTERM (15) -> exit 143 (128+15)
- Handler must: 
  1. Use `fs.writeSync(2, '\x1b[?25h\n')` - SYNCHRONOUS, to guarantee before exit in signal context
  2. Then `process.exit(code)`
- If process object missing -> no-op

This prevents cursor leakage (hidden cursor left behind).
