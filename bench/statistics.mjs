function sorted(values) {
  return [...values].sort((left, right) => left - right)
}

export function percentile(values, fraction) {
  const ordered = sorted(values)
  const index = Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * fraction) - 1))
  return ordered[index]
}

export function median(values) {
  return percentile(values, 0.5)
}

export function medianAbsoluteDeviation(values) {
  const center = median(values)
  return median(values.map((value) => Math.abs(value - center)))
}

function random(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

export function bootstrapMedianInterval(values, iterations = 1000, seed = 0x5f3759df) {
  const next = random(seed)
  const samples = Array.from({ length: iterations }, () => {
    const resample = Array.from(
      { length: values.length },
      () => values[Math.floor(next() * values.length)],
    )
    return median(resample)
  })
  return { lower: percentile(samples, 0.025), upper: percentile(samples, 0.975) }
}

export function summarize(values) {
  const medianValue = median(values)
  const mad = medianAbsoluteDeviation(values)
  return {
    confidenceInterval: bootstrapMedianInterval(values),
    mad,
    median: medianValue,
    p95: percentile(values, 0.95),
    relativeMad: medianValue === 0 ? 0 : mad / medianValue,
  }
}
