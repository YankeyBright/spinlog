import { applyAnsiStyle } from './ansi.js'
import { getCapabilities } from './env.js'
import type { FlowOptions } from './index.js'
import { writeCoordinatedLine } from './renderer.js'
import {
  requireColorOption,
  requireIndent,
  requireOptions,
  requireUnicodeMode,
} from './spinner-options.js'
import { requireString, resolveRenderTarget, sanitizeSegment } from './text.js'

function writeFlow(
  unicodeSymbol: string,
  asciiSymbol: string,
  message: unknown,
  options: FlowOptions | undefined,
): void {
  // Validate before capability detection so invalid calls have no observable effects.
  const validated = message === undefined ? '' : requireString(message, 'message')
  const safeOptions = requireOptions(options ?? {})
  const target = resolveRenderTarget(safeOptions.stream)
  const configuredColor = requireColorOption(safeOptions.color, 'blackBright')
  const unicode = requireUnicodeMode(safeOptions.unicode ?? 'auto')
  const indent = ' '.repeat(requireIndent(safeOptions.indent ?? 0))
  const capabilities = getCapabilities(target, 'auto', unicode)
  const symbol = capabilities.unicode ? unicodeSymbol : asciiSymbol
  const marker =
    configuredColor !== false && capabilities.color
      ? applyAnsiStyle(configuredColor, symbol)
      : symbol
  const text = sanitizeSegment(validated)
  const content = text ? `${marker}  ${text}` : marker

  writeCoordinatedLine(target, `${indent}${content}\n`)
}

/** Write an opening flow marker above any active spinner frame. */
export function intro(message?: string, options?: FlowOptions): void {
  writeFlow('┌', '>', message, options)
}

/** Write a closing flow marker above any active spinner frame. */
export function outro(message?: string, options?: FlowOptions): void {
  writeFlow('└', '<', message, options)
}
