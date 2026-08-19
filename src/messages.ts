import { applyAnsiStyle } from './ansi.js'
import { getCapabilities } from './env.js'
import { requireString, sanitizeSegment, tryWrite } from './text.js'

function writeFlow(unicodeSymbol: string, asciiSymbol: string, message: unknown): void {
  // Validate before capability detection so invalid calls have no observable effects.
  const validated = message === undefined ? '' : requireString(message, 'message')
  const [colorEnabled, , unicodeEnabled] = getCapabilities()
  const symbol = unicodeEnabled ? unicodeSymbol : asciiSymbol
  const marker = colorEnabled ? applyAnsiStyle('blackBright', symbol) : symbol
  const text = sanitizeSegment(validated)

  tryWrite(text ? `${marker}  ${text}\n` : `${marker}\n`)
}

/** Write an independent opening flow marker to stderr. */
export function intro(message?: string): void {
  writeFlow('┌', '>', message)
}

/** Write an independent closing flow marker to stderr. */
export function outro(message?: string): void {
  writeFlow('└', '<', message)
}
