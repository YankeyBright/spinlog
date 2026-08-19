/** Compare canonical evidence keys by their stable JavaScript string code units. */
export function compareCanonicalText(left, right) {
  const first = String(left)
  const second = String(right)
  if (first === second) return 0
  return first < second ? -1 : 1
}

/** Return a canonically ordered copy without mutating the caller's collection. */
export function sortCanonicalText(values) {
  return [...values].sort(compareCanonicalText)
}
