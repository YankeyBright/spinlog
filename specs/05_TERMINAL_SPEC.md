# Terminal Protocol

`specs/v1-behavior.json` is normative for terminal behavior. The 0.2 pre-1.0 API must implement it without external runtime packages.

## Output targets and ownership

Every renderable surface defaults to `process.stderr` and may receive an explicit writable stream through `stream`. A target is a Node writable together with its live `isTTY`, `columns`, and `rows` properties. Spinlog never patches `console`, `process.stderr.write`, or arbitrary writable methods; it never manages stdin.

There is one interactive surface per writable stream. A group is one multi-row surface. Independent writable streams can animate at the same time, while a second root surface on the same target uses its configured static policy until an explicit restart after lease release. Flow and instance log writes coordinate only with the active Spinlog surface on their own target; direct application writes remain application-owned and may interleave.

- The default target never writes to `stdout`; an application may deliberately pass a different writable.
- The library installs no process signal or exit listener and never terminates the host process.
- Applications own stream errors, shutdown, raw input, and all stdin policy.
- Explicit lifecycle methods and `Symbol.dispose` restore a cursor only when the surface owns it.

## ANSI styles and text safety

Use Select Graphic Rendition sequences in the form `\x1b[<code>m`. Foreground colors are 30–37 and 90–97, backgrounds are 40–47 and 100–107, and modifiers are reset 0, bold 1/22, dim 2/22, italic 3/23, underline 4/24, and strikethrough 9/29. Nested non-reset styles restore their enclosing opening sequence; `reset` is a hard boundary.

SGR, cursor control, color, emphasis, animation, and Unicode are separate named capability decisions. Style helpers read default-stderr capability only, return strings, and never write. On a recognized interactive terminal, explicit `reset`, `bold`, `dim`, `italic`, `underline`, and `strikethrough` remain available when color is disabled.

User-controlled `text`, `prefix`, `suffix`, terminal text overrides, group child fields, progress text, flow messages, and logs are sanitized only when rendered. Node’s `stripVTControlCharacters` is applied, remaining C0/C1, bidi, and line-separator controls are replaced with spaces, and segment boundaries are trimmed. Assigned values remain unchanged. An immutable sanitized snapshot and grapheme-aware terminal-cell width are created lazily at the rendering boundary and are invalidated only by text, prefix, or suffix mutation. Caller-defined custom frames are the explicit exception: they are sanitized, validated for visibility, and frozen when the definition is accepted.

Combining marks and formatting code points consume no independent cell, ordinary and ambiguous-width graphemes consume one, and East Asian wide/full-width or emoji grapheme clusters consume two. Multi-code-point and multi-character custom frames are measured in full.

## Built-ins and render controls

The default dots frames are `\u280b`, `\u2819`, `\u2839`, `\u2838`, `\u283c`, `\u2834`, `\u2826`, `\u2827`, `\u2807`, and `\u280f`; line frames are `-`, `\\`, `|`, and `/`. A caller-defined spinner snapshots one to 64 visible definition-time-sanitized frames at 16–60,000ms. One-frame definitions are static and create no timer.

Status symbols are `\u2714`, `\u2716`, `\u26a0`, and `\u2139`, with ASCII fallbacks `+`, `x`, `!`, and `i`. Frame color applies only to active symbols and status color only to status symbols. `color: false` disables every automatic color for that surface. `unicode: false` forces ASCII built-ins and progress bars, while custom frames remain caller-supplied definition-time-sanitized snapshots. `hideCursor: false` suppresses cursor hide/show escapes. `indent` is a safe integer from 0 through 40 and prefixes every generated line.

## Interactive, static, and capability policy

Interactive rendering writes its first frame synchronously and uses unreferenced timers. Automatic animation requires a target TTY, usable target width, and a conservative recognized terminal profile. `terminal: 'interactive'` is an informed override for a non-dumb TTY but never enables color itself. `terminal: 'static'` disables animation and cursor control.

Spinlog intentionally preserves a v1 color-environment compatibility policy that differs from [Node's CLI color policy](https://nodejs.org/api/cli.html#force_color1-2-3). Precedence is highest to lowest:

1. A non-empty `NO_COLOR` disables automatic foreground/background color.
2. A non-empty `NODE_DISABLE_COLORS` disables automatic foreground/background color.
3. `FORCE_COLOR=0` or `FORCE_COLOR=false` disables color; any other defined value, including an empty or Node-unsupported value, enables ANSI-16 color and emphasis.
4. Otherwise CI, `TERM=dumb`, `NODE_ENV=test`, non-TTY targets, unknown profiles, and empty `TERM` conservatively disable automatic features.

Known automatic cursor profiles are `xterm`, `screen`, `tmux`, `rxvt`, `linux`, `cygwin`, `st`, `alacritty`, `kitty`, `wezterm`, `foot`, `konsole`, `vte`, `eterm`, and `putty`, matched as an ASCII-lowercase exact name or dash suffix. `vt100` and `vt220` are static by default. Windows Unicode auto-detection requires `WT_SESSION`.

Width must be at least three cells and each rendered row must be strictly narrower than `target.columns - 1`; unavailable, narrow, resized, or overflowing width demotes to static output. Groups additionally require known target rows and a safe row budget. `maxRows` defaults to `min(10, target.rows - 1)`; an unavailable or exceeded budget atomically demotes the whole group. Terminal override does not waive this height rule.

`static` defaults to `'symbol'`; `'text'` emits sanitized unstyled text and `'silent'` suppresses automatic static start/settlement lines. These modes cover non-interactive operation, target-local lease contention, terminal-static mode, width demotion, and height demotion.

## Groups and progress

Groups render all active rows as one target-local lease and one unreferenced scheduler. Settled and static rows become permanent history and never reappear in later sessions. A child that started static remains static until explicitly stopped and restarted. Once no active surface rows remain, the group session releases its lease so a later explicit restart can attempt interactive rendering again. Groups neither nest nor dynamically reorder rows.

Progress is a timer-free single-row surface. `total` is a positive safe integer exposed through an immutable runtime getter. `value` is a safe integer from zero through total; `increment()` accepts only positive safe integers. Width is 5–40, default 20. The default block bar falls back to ASCII when Unicode is unavailable. Filled-cell count uses `Math.floor`, and `succeed()` sets value to total before rendering; failure, warning, and information preserve actual value.

## Writes and recovery

Write outcomes are `written`, `backpressured`, or `failed`. Permanent lines write in call order. Each accepted permanent write receives a monotonic sequence and completes only when Node invokes its write callback; `flush()` snapshots that sequence watermark, so later writes do not extend it. A ready target attempts its first permanent write immediately, regardless of its size. Once backpressured or re-entrant, Spinlog caps pending permanent output at 64 tasks or 64 KiB and coalesces only the latest cosmetic frame. Temporary `drain`, `finish`, `close`, and `error` listeners remain even when an interactive lease ends. `drain` resumes queued output; normal `finish` resolves a flush only when no unwritten permanent task remains; premature `finish`, `close`, or a target `error` rejects it. Every completion path removes all temporary listeners, and no unbounded library-owned queue is created.

A synchronous write failure stops only the affected target surface, clears its timer, and restores a cursor it owns. Terminal state and promise settlement remain logical outcomes. Cleanup failures are suppressed. Asynchronous stream errors remain host-owned when Spinlog has no pending output; while it does, Spinlog rejects affected flushes with `SpinlogTargetError`, preserves the original error as its cause, and clears only target-local work.
