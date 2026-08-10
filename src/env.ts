/** Terminal color, animation, and Unicode capabilities. */
export type Capabilities = readonly [color: boolean, animation: boolean, unicode: boolean]

function disablesTerminalFeatures(env: NodeJS.ProcessEnv, isTTY: boolean): boolean {
  return Boolean(env.CI) || env.TERM === 'dumb' || env.NODE_ENV === 'test' || !isTTY
}

/** Resolve terminal capabilities without writing to, or taking ownership of, a stream. */
export function getCapabilities(
  env: NodeJS.ProcessEnv = process.env,
  isTTY: boolean = process.stderr.isTTY === true,
  platform: NodeJS.Platform = process.platform,
): Capabilities {
  const terminalDisabled = disablesTerminalFeatures(env, isTTY)
  const colorDisabled = Boolean(env.NO_COLOR) || Boolean(env.NODE_DISABLE_COLORS)
  const forceColor = env.FORCE_COLOR

  // Explicit disable requests outrank FORCE_COLOR; FORCE_COLOR affects color only.
  const color = colorDisabled
    ? false
    : forceColor === undefined
      ? !terminalDisabled
      : forceColor !== '0' && forceColor !== 'false'

  return [color, !terminalDisabled, platform !== 'win32' || Boolean(env.WT_SESSION)]
}
