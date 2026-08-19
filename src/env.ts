/** Terminal color, animation, and Unicode capabilities. */
export type Capabilities = readonly [color: boolean, animation: boolean, unicode: boolean]

function disablesTerminalFeatures(env: NodeJS.ProcessEnv, isTTY: boolean): boolean {
  return Boolean(env.CI) || env.TERM === 'dumb' || env.NODE_ENV === 'test' || !isTTY
}

function resolveColor(env: NodeJS.ProcessEnv, terminalDisabled: boolean): boolean {
  if (env.NO_COLOR || env.NODE_DISABLE_COLORS) return false
  if (env.FORCE_COLOR !== undefined) return env.FORCE_COLOR !== '0' && env.FORCE_COLOR !== 'false'
  return !terminalDisabled
}

/** Resolve terminal capabilities without writing to, or taking ownership of, a stream. */
export function getCapabilities(
  env: NodeJS.ProcessEnv = process.env,
  isTTY: boolean = process.stderr.isTTY === true,
  platform: NodeJS.Platform = process.platform,
): Capabilities {
  const terminalDisabled = disablesTerminalFeatures(env, isTTY)
  return [
    resolveColor(env, terminalDisabled),
    !terminalDisabled,
    platform !== 'win32' || Boolean(env.WT_SESSION),
  ]
}
