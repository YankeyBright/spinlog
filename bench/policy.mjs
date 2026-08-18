export const BENCHMARK_SCHEMA_VERSION = 2
export const BASELINE_SCHEMA_VERSION = 2
export const BENCHMARK_SCENARIOS = Object.freeze([
  'root-cold-import-ns',
  'styles-cold-import-ns',
  'enabled-style-ns',
  'disabled-style-ns',
  'static-spinner-settlement-ns',
  'resolved-promise-wrapper-ns',
])

const COMMIT = /^[0-9a-f]{40}$/u
const SHA256 = /^[0-9a-f]{64}$/u

function finite(value) {
  return Number.isFinite(value)
}

function sameValues(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function validateBenchmarkResult(result, expectedMode) {
  const failures = []
  const sampleCount = expectedMode === 'full' ? 30 : 5

  if (result?.schemaVersion !== BENCHMARK_SCHEMA_VERSION) {
    failures.push(`benchmark schemaVersion must be ${BENCHMARK_SCHEMA_VERSION}`)
  }
  if (result?.mode !== expectedMode) failures.push(`benchmark mode must be ${expectedMode}`)
  if (typeof result?.node !== 'string' || typeof result?.platform !== 'string') {
    failures.push('benchmark must record Node and platform identity')
  }
  const scenarios = Array.isArray(result?.scenarios) ? result.scenarios : []
  if (
    !sameValues(
      scenarios.map(({ name }) => name),
      BENCHMARK_SCENARIOS,
    )
  ) {
    failures.push('benchmark must contain the six ordered Phase 3 scenarios exactly once')
  }

  for (const scenario of scenarios) {
    const statistics = scenario?.statistics
    if (!Number.isInteger(scenario?.attempts) || scenario.attempts < 1 || scenario.attempts > 3) {
      failures.push(`benchmark scenario attempts must be between one and three: ${scenario?.name}`)
    }
    if (!Number.isInteger(scenario?.iterations) || scenario.iterations < 1) {
      failures.push(`benchmark scenario iterations must be a positive integer: ${scenario?.name}`)
    }
    if (
      !Array.isArray(scenario?.samples) ||
      scenario.samples.length !== sampleCount ||
      scenario.samples.some((value) => !finite(value) || value <= 0)
    ) {
      failures.push(
        `benchmark scenario must contain ${sampleCount} positive finite samples: ${scenario?.name}`,
      )
    }
    if (
      !finite(statistics?.median) ||
      statistics.median <= 0 ||
      !finite(statistics?.p95) ||
      statistics.p95 < statistics.median ||
      !finite(statistics?.mad) ||
      statistics.mad < 0 ||
      !finite(statistics?.relativeMad) ||
      statistics.relativeMad < 0 ||
      (expectedMode === 'full' && statistics.relativeMad > 0.15) ||
      !finite(statistics?.confidenceInterval?.lower) ||
      !finite(statistics?.confidenceInterval?.upper) ||
      statistics.confidenceInterval.lower > statistics.median ||
      statistics.confidenceInterval.upper < statistics.median
    ) {
      failures.push(`benchmark scenario statistics are invalid or unstable: ${scenario?.name}`)
    }
  }

  return [...new Set(failures)]
}

export function validateBaseline(baseline) {
  const failures = []
  const provenance = baseline?.provenance
  const digests = Array.isArray(provenance?.inputs) ? provenance.inputs : []

  if (baseline?.schemaVersion !== BASELINE_SCHEMA_VERSION) {
    failures.push(`benchmark baseline schemaVersion must be ${BASELINE_SCHEMA_VERSION}`)
  }
  if (
    baseline?.runs !== 5 ||
    baseline?.platform !== 'linux' ||
    typeof baseline?.node !== 'string' ||
    !baseline.node.startsWith('v24.')
  ) {
    failures.push('benchmark baseline must contain five Node 24 Linux runs')
  }
  if (
    !COMMIT.test(provenance?.commit ?? '') ||
    !/^\d+$/u.test(provenance?.githubRunId ?? '') ||
    !/^\d+$/u.test(provenance?.githubRunAttempt ?? '')
  ) {
    failures.push('benchmark baseline must identify one GitHub commit and workflow attempt')
  }
  if (
    digests.length !== 5 ||
    !sameValues(
      digests.map(({ slot }) => slot).sort((left, right) => left - right),
      [1, 2, 3, 4, 5],
    ) ||
    new Set(digests.map(({ sha256 }) => sha256)).size !== 5 ||
    digests.some(({ sha256 }) => !SHA256.test(sha256 ?? ''))
  ) {
    failures.push(
      'benchmark baseline must identify five unique CI input artifacts in slots one through five',
    )
  }

  const scenarios = baseline?.scenarios
  if (
    scenarios === null ||
    Array.isArray(scenarios) ||
    typeof scenarios !== 'object' ||
    !sameValues(Object.keys(scenarios).sort(), [...BENCHMARK_SCENARIOS].sort())
  ) {
    failures.push('benchmark baseline must contain exactly the six Phase 3 scenarios')
  } else {
    for (const name of BENCHMARK_SCENARIOS) {
      const scenario = scenarios[name]
      if (
        !finite(scenario?.median) ||
        scenario.median <= 0 ||
        !finite(scenario?.confidenceInterval?.lower) ||
        !finite(scenario?.confidenceInterval?.upper) ||
        scenario.confidenceInterval.lower > scenario.median ||
        scenario.confidenceInterval.upper < scenario.median
      ) {
        failures.push(`benchmark baseline scenario statistics are invalid: ${name}`)
      }
    }
  }

  return [...new Set(failures)]
}
