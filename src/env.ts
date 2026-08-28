import type { RenderTarget } from './text.js'

export type TerminalMode = 'auto' | 'static' | 'interactive'
export type UnicodeMode = 'auto' | boolean

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

/** Spinlog v1 compatibility policy; see the documented Node CLI divergence. */
function spinlogDisablesColor(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.NO_COLOR || env.NODE_DISABLE_COLORS)
}

function spinlogForcesColor(env: NodeJS.ProcessEnv): boolean {
  return env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '0' && env.FORCE_COLOR !== 'false'
}

/** SGR and cursor support are related but independent terminal capabilities. */
function hasSgrSupport(env: NodeJS.ProcessEnv, isTTY: boolean): boolean {
  return spinlogForcesColor(env) || (!isDumbTerminal(env) && hasKnownCursorProfile(env, isTTY))
}

function resolveColor(env: NodeJS.ProcessEnv, sgr: boolean, automaticDisabled: boolean): boolean {
  if (spinlogDisablesColor(env)) return false
  if (env.FORCE_COLOR !== undefined) return spinlogForcesColor(env)
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
  const sgr = hasSgrSupport(env, isTTY)
  const color = resolveColor(env, sgr, automaticDisabled)
  const emphasis =
    sgr && (spinlogForcesColor(env) || (isTTY && (!automaticDisabled || spinlogDisablesColor(env))))

  return (color ? COLOR_CAPABILITY : 0) | (emphasis ? EMPHASIS_CAPABILITY : 0)
}

/** Resolve only the SGR decisions needed by the tree-shakeable styles entrypoint. */
export function getStyleCapabilities(): number {
  return resolveStyleCapabilities(process.env, process.stderr.isTTY === true)
}

/** Resolve terminal capabilities without writing to, or taking ownership of, a stream. */
export function getCapabilities(
  target: RenderTarget,
  terminal: TerminalMode = 'auto',
  unicode: UnicodeMode = 'auto',
): Capabilities {
  return resolveCapabilities(process.env, target.isTTY, process.platform, terminal, unicode)
}

function resolveCapabilities(
  env: NodeJS.ProcessEnv,
  isTTY: boolean,
  platform: NodeJS.Platform,
  terminal: TerminalMode,
  unicode: UnicodeMode,
): Capabilities {
  const cursor = hasKnownCursorProfile(env, isTTY)
  const sgr = hasSgrSupport(env, isTTY)
  const style = resolveStyleCapabilities(env, isTTY)

  return Object.freeze({
    sgr,
    cursor,
    color: (style & COLOR_CAPABILITY) !== 0,
    // NO_COLOR controls color only; emphasis remains useful on a known capable terminal.
    emphasis: (style & EMPHASIS_CAPABILITY) !== 0,
    animation: resolveAnimation(env, isTTY, cursor, terminal),
    unicode: resolveUnicode(env, platform, unicode),
  })
}

function resolveUnicode(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  unicode: UnicodeMode,
): boolean {
  if (typeof unicode === 'boolean') return unicode
  return platform !== 'win32' || Boolean(env.WT_SESSION)
}
