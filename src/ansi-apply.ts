import { RESET, SHARED, type StyleDefinition } from './ansi-metadata.js'

/** Build an SGR sequence from the canonical numeric metadata. */
export function sgrSequence(code: number): string {
  return `\x1b[${code}m`
}

/** Apply deterministic nested restoration with a caller-supplied metadata record. */
export function applyAnsiDefinition(definition: StyleDefinition, text: string): string {
  const opening = sgrSequence(definition.open)
  const closing = sgrSequence(definition.close)
  if (definition.mode === RESET) return `${opening}${text}${closing}`

  // Re-open the outer style after an inner close so nested helpers cannot
  // accidentally leave the caller's style disabled.
  const restore = definition.mode === SHARED ? `${closing}${opening}` : opening
  return `${opening}${text.replaceAll(closing, restore)}${closing}`
}

/** Normalize a known outer style according to its metadata restoration strategy. */
export function normalizeWithDefinition(formatted: string, definition: StyleDefinition): string {
  if (definition.mode === RESET) return formatted

  const opening = sgrSequence(definition.open)
  const closing = sgrSequence(definition.close)
  const closingStart = formatted.lastIndexOf(closing)
  if (closingStart < opening.length || formatted.slice(closingStart) !== closing) return formatted

  // Reconstruct only the outer style. Unknown or already-normalized segments
  // are preserved verbatim so this helper remains safe for arbitrary SGR text.
  const [first = '', ...segments] = formatted.slice(opening.length, closingStart).split(closing)
  let restored = first
  for (const segment of segments) {
    if (definition.mode === SHARED) restored += closing
    if (!segment.startsWith(opening)) restored += opening
    restored += segment
  }
  return `${opening}${restored}${closing}`
}
