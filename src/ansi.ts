import { applyAnsiDefinition, normalizeWithDefinition, sgrSequence } from './ansi-apply.js'
import {
  bgBlackBrightDefinition,
  bgBlackDefinition,
  bgBlueBrightDefinition,
  bgBlueDefinition,
  bgCyanBrightDefinition,
  bgCyanDefinition,
  bgGreenBrightDefinition,
  bgGreenDefinition,
  bgMagentaBrightDefinition,
  bgMagentaDefinition,
  bgRedBrightDefinition,
  bgRedDefinition,
  bgWhiteBrightDefinition,
  bgWhiteDefinition,
  bgYellowBrightDefinition,
  bgYellowDefinition,
  blackBrightDefinition,
  blackDefinition,
  blueBrightDefinition,
  blueDefinition,
  boldDefinition,
  cyanBrightDefinition,
  cyanDefinition,
  dimDefinition,
  greenBrightDefinition,
  greenDefinition,
  italicDefinition,
  isForegroundDefinition,
  magentaBrightDefinition,
  magentaDefinition,
  redBrightDefinition,
  redDefinition,
  resetDefinition,
  strikethroughDefinition,
  type AnsiStyle,
  type StyleDefinition,
  underlineDefinition,
  whiteBrightDefinition,
  whiteDefinition,
  yellowBrightDefinition,
  yellowDefinition,
} from './ansi-metadata.js'

export type { AnsiStyle, StyleDefinition } from './ansi-metadata.js'

/** One source of truth for SGR codes, categories, validation, and restoration. */
const STYLE_DEFINITIONS: Readonly<Record<AnsiStyle, StyleDefinition>> = Object.freeze({
  reset: resetDefinition,
  bold: boldDefinition,
  dim: dimDefinition,
  italic: italicDefinition,
  underline: underlineDefinition,
  strikethrough: strikethroughDefinition,
  black: blackDefinition,
  red: redDefinition,
  green: greenDefinition,
  yellow: yellowDefinition,
  blue: blueDefinition,
  magenta: magentaDefinition,
  cyan: cyanDefinition,
  white: whiteDefinition,
  blackBright: blackBrightDefinition,
  redBright: redBrightDefinition,
  greenBright: greenBrightDefinition,
  yellowBright: yellowBrightDefinition,
  blueBright: blueBrightDefinition,
  magentaBright: magentaBrightDefinition,
  cyanBright: cyanBrightDefinition,
  whiteBright: whiteBrightDefinition,
  bgBlack: bgBlackDefinition,
  bgRed: bgRedDefinition,
  bgGreen: bgGreenDefinition,
  bgYellow: bgYellowDefinition,
  bgBlue: bgBlueDefinition,
  bgMagenta: bgMagentaDefinition,
  bgCyan: bgCyanDefinition,
  bgWhite: bgWhiteDefinition,
  bgBlackBright: bgBlackBrightDefinition,
  bgRedBright: bgRedBrightDefinition,
  bgGreenBright: bgGreenBrightDefinition,
  bgYellowBright: bgYellowBrightDefinition,
  bgBlueBright: bgBlueBrightDefinition,
  bgMagentaBright: bgMagentaBrightDefinition,
  bgCyanBright: bgCyanBrightDefinition,
  bgWhiteBright: bgWhiteBrightDefinition,
})

const STYLE_BY_OPENING = new Map(
  Object.values(STYLE_DEFINITIONS).map((definition) => [sgrSequence(definition.open), definition]),
)

/** Resolve a known helper to its canonical internal metadata. */
export function getStyleDefinition(style: AnsiStyle): StyleDefinition {
  return STYLE_DEFINITIONS[style]
}

/** Validate the foreground-only colors accepted by spinner frames. */
export function isSpinnerColor(value: string): boolean {
  return isForegroundDefinition(STYLE_DEFINITIONS[value as AnsiStyle])
}

/** Normalize arbitrary supported SGR input using the canonical metadata table. */
export function normalizeStyleNesting(formatted: string): string {
  const openingEnd = formatted.indexOf('m') + 1
  if (!formatted.startsWith('\x1b[') || openingEnd === 0) return formatted

  const opening = formatted.slice(0, openingEnd)
  const definition = STYLE_BY_OPENING.get(opening)
  return definition === undefined ? formatted : normalizeWithDefinition(formatted, definition)
}

/** Apply one known ANSI style while preserving its frozen nesting behavior. */
export function applyAnsiStyle(format: AnsiStyle, text: string): string {
  return applyAnsiDefinition(getStyleDefinition(format), text)
}
