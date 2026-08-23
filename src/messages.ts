import { applyAnsiStyle } from './ansi.js'
import { getCapabilities } from './env.js'
import { writeCoordinatedLine } from './renderer.js'
import { requireString, sanitizeSegment } from './text.js'

function writeFlow(unicodeSymbol: string, asciiSymbol: string, message: unknown): void {
  // Validate before capability detection so invalid calls have no observable effects.
  const validated = message === undefined ? '' : requireString(message, 'message')
  const capabilities = getCapabilities()
  const symbol = capabilities.unicode ? unicodeSymbol : asciiSymbol
  const marker = capabilities.color ? applyAnsiStyle('blackBright', symbol) : symbol
  const text = sanitizeSegment(validated)

  writeCoordinatedLine(text ? `${marker}  ${text}\n` : `${marker}\n`)
}

/** Write an opening flow marker above any active spinner frame. */
export function intro(message?: string): void {
  writeFlow('┌', '>', message)
}

/** Write a closing flow marker above any active spinner frame. */
export function outro(message?: string): void {
  writeFlow('└', '<', message)
}
