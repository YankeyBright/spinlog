type StyleKind = 0 | 1 | 2
type RestoreMode = 0 | 1 | 2

export const EMPHASIS: StyleKind = 0
export const FOREGROUND: StyleKind = 1
const BACKGROUND: StyleKind = 2

export const CHANNEL: RestoreMode = 0
export const SHARED: RestoreMode = 1
export const RESET: RestoreMode = 2

/** Internal SGR metadata shared by the renderer and tree-shakeable style helpers. */
export type StyleDefinition = Readonly<{
  kind: StyleKind
  open: number
  close: number
  mode: RestoreMode
}>

export type AnsiStyle =
  | 'reset'
  | 'bold'
  | 'dim'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'blackBright'
  | 'redBright'
  | 'greenBright'
  | 'yellowBright'
  | 'blueBright'
  | 'magentaBright'
  | 'cyanBright'
  | 'whiteBright'
  | 'bgBlack'
  | 'bgRed'
  | 'bgGreen'
  | 'bgYellow'
  | 'bgBlue'
  | 'bgMagenta'
  | 'bgCyan'
  | 'bgWhite'
  | 'bgBlackBright'
  | 'bgRedBright'
  | 'bgGreenBright'
  | 'bgYellowBright'
  | 'bgBlueBright'
  | 'bgMagentaBright'
  | 'bgCyanBright'
  | 'bgWhiteBright'

export const resetDefinition: StyleDefinition = {
  kind: EMPHASIS,
  open: 0,
  close: 0,
  mode: RESET,
}
export const boldDefinition: StyleDefinition = {
  kind: EMPHASIS,
  open: 1,
  close: 22,
  mode: SHARED,
}
export const dimDefinition: StyleDefinition = {
  kind: EMPHASIS,
  open: 2,
  close: 22,
  mode: SHARED,
}
export const italicDefinition: StyleDefinition = {
  kind: EMPHASIS,
  open: 3,
  close: 23,
  mode: SHARED,
}
export const underlineDefinition: StyleDefinition = {
  kind: EMPHASIS,
  open: 4,
  close: 24,
  mode: SHARED,
}
export const strikethroughDefinition: StyleDefinition = {
  kind: EMPHASIS,
  open: 9,
  close: 29,
  mode: SHARED,
}

export const blackDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 30,
  close: 39,
  mode: CHANNEL,
}
export const redDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 31,
  close: 39,
  mode: CHANNEL,
}
export const greenDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 32,
  close: 39,
  mode: CHANNEL,
}
export const yellowDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 33,
  close: 39,
  mode: CHANNEL,
}
export const blueDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 34,
  close: 39,
  mode: CHANNEL,
}
export const magentaDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 35,
  close: 39,
  mode: CHANNEL,
}
export const cyanDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 36,
  close: 39,
  mode: CHANNEL,
}
export const whiteDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 37,
  close: 39,
  mode: CHANNEL,
}
export const blackBrightDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 90,
  close: 39,
  mode: CHANNEL,
}
export const redBrightDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 91,
  close: 39,
  mode: CHANNEL,
}
export const greenBrightDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 92,
  close: 39,
  mode: CHANNEL,
}
export const yellowBrightDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 93,
  close: 39,
  mode: CHANNEL,
}
export const blueBrightDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 94,
  close: 39,
  mode: CHANNEL,
}
export const magentaBrightDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 95,
  close: 39,
  mode: CHANNEL,
}
export const cyanBrightDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 96,
  close: 39,
  mode: CHANNEL,
}
export const whiteBrightDefinition: StyleDefinition = {
  kind: FOREGROUND,
  open: 97,
  close: 39,
  mode: CHANNEL,
}

export const bgBlackDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 40,
  close: 49,
  mode: CHANNEL,
}
export const bgRedDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 41,
  close: 49,
  mode: CHANNEL,
}
export const bgGreenDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 42,
  close: 49,
  mode: CHANNEL,
}
export const bgYellowDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 43,
  close: 49,
  mode: CHANNEL,
}
export const bgBlueDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 44,
  close: 49,
  mode: CHANNEL,
}
export const bgMagentaDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 45,
  close: 49,
  mode: CHANNEL,
}
export const bgCyanDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 46,
  close: 49,
  mode: CHANNEL,
}
export const bgWhiteDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 47,
  close: 49,
  mode: CHANNEL,
}
export const bgBlackBrightDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 100,
  close: 49,
  mode: CHANNEL,
}
export const bgRedBrightDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 101,
  close: 49,
  mode: CHANNEL,
}
export const bgGreenBrightDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 102,
  close: 49,
  mode: CHANNEL,
}
export const bgYellowBrightDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 103,
  close: 49,
  mode: CHANNEL,
}
export const bgBlueBrightDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 104,
  close: 49,
  mode: CHANNEL,
}
export const bgMagentaBrightDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 105,
  close: 49,
  mode: CHANNEL,
}
export const bgCyanBrightDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 106,
  close: 49,
  mode: CHANNEL,
}
export const bgWhiteBrightDefinition: StyleDefinition = {
  kind: BACKGROUND,
  open: 107,
  close: 49,
  mode: CHANNEL,
}

/** Keep spinner foreground eligibility in the same metadata domain as style kind. */
export function isForegroundDefinition(definition: StyleDefinition | undefined): boolean {
  if (definition?.kind === FOREGROUND) return true
  return false
}
