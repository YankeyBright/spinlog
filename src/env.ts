export type TerminalMode = 'auto' | 'static' | 'interactive'

const CURSOR_TERMINAL =
  /^(?:xterm|screen|tmux|rxvt|linux|cygwin|st|alacritty|kitty|wezterm|foot|konsole|vte|eterm|putty)(?:-|$)/u

/** Terminal capabilities resolved once for a rendering cycle. */
export interface Capabilities {
  readonly sgr: boolean
  readonly cursor: boolean
  readonly color: boolean
  readonly emphasis: boolean
  readonly animation: boolean
  readonly unicode: boolean
}

const COLOR_CAPABILITY = 1
const EMPHASIS_CAPABILITY = 2

function isDumbTerminal(env: NodeJS.ProcessEnv): boolean {
  return env.TERM?.toLowerCase() === 'dumb'
}

function hasKnownCursorProfile(env: NodeJS.ProcessEnv, isTTY: boolean): boolean {
  if (!isTTY) return false
  if (env.WT_SESSION) return true

  const term = env.TERM?.toLowerCase()
  return term !== undefined && CURSOR_TERMINAL.test(term)
}

function disablesAutomaticFeatures(env: NodeJS.ProcessEnv, isTTY: boolean): boolean {
  return Boolean(env.CI) || isDumbTerminal(env) || env.NODE_ENV === 'test' || !isTTY
}

function resolveColor(env: NodeJS.ProcessEnv, sgr: boolean, automaticDisabled: boolean): boolean {
  if (env.NO_COLOR || env.NODE_DISABLE_COLORS) return false
  if (env.FORCE_COLOR !== undefined) return env.FORCE_COLOR !== '0' && env.FORCE_COLOR !== 'false'
  return sgr && !automaticDisabled
}

function resolveAnimation(
  env: NodeJS.ProcessEnv,
  isTTY: boolean,
  cursor: boolean,
  terminal: TerminalMode,
): boolean {
  if (terminal === 'static' || !isTTY || isDumbTerminal(env)) return false
  return terminal === 'interactive' || (cursor && !disablesAutomaticFeatures(env, isTTY))
}

function resolveStyleCapabilities(env: NodeJS.ProcessEnv, isTTY: boolean): number {
  const automaticDisabled = disablesAutomaticFeatures(env, isTTY)
  const sgr = hasKnownCursorProfile(env, isTTY)
  const color = resolveColor(env, sgr, automaticDisabled)

  return (
    (color ? COLOR_CAPABILITY : 0) |
    (sgr && (color || !automaticDisabled) ? EMPHASIS_CAPABILITY : 0)
  )
}

/** Resolve only the SGR decisions needed by the tree-shakeable styles entrypoint. */
export function getStyleCapabilities(
  env: NodeJS.ProcessEnv = process.env,
  isTTY: boolean = process.stderr.isTTY === true,
): number {
  return resolveStyleCapabilities(env, isTTY)
}

/** Resolve terminal capabilities without writing to, or taking ownership of, a stream. */
export function getCapabilities(
  env: NodeJS.ProcessEnv = process.env,
  isTTY: boolean = process.stderr.isTTY === true,
  platform: NodeJS.Platform = process.platform,
  terminal: TerminalMode = 'auto',
): Capabilities {
  const cursor = hasKnownCursorProfile(env, isTTY)
  const style = resolveStyleCapabilities(env, isTTY)

  return Object.freeze({
    sgr: cursor,
    cursor,
    color: (style & COLOR_CAPABILITY) !== 0,
    // NO_COLOR controls color only; emphasis remains useful on a known capable terminal.
    emphasis: (style & EMPHASIS_CAPABILITY) !== 0,
    animation: resolveAnimation(env, isTTY, cursor, terminal),
    unicode: platform !== 'win32' || Boolean(env.WT_SESSION),
  })
}
