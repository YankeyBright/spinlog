import { sortCanonicalText } from '../scripts/canonical-order.mjs'

import { summarize } from './statistics.mjs'

export const BENCHMARK_SCHEMA_VERSION = 4
export const BASELINE_SCHEMA_VERSION = 4
export const BENCHMARK_SCENARIOS = Object.freeze([
  'root-cold-import-ns',
  'styles-cold-import-ns',
  'enabled-style-ns',
  'disabled-style-ns',
  'static-spinner-settlement-ns',
  'resolved-promise-wrapper-ns',
  'intro-flow-message-ns',
  'outro-flow-message-ns',
  'instance-log-ns',
])

const COMMIT = /^[0-9a-f]{40}$/u
const SHA256 = /^[0-9a-f]{64}$/u
const SUMMARY_TOLERANCE = Number.EPSILON

function finite(value) {
  return Number.isFinite(value)
}

function sameValues(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function hasValidSamples(scenario, sampleCount) {
  return (
    Array.isArray(scenario?.samples) &&
    scenario.samples.length === sampleCount &&
    scenario.samples.every((value) => finite(value) && value > 0)
  )
}

function hasValidStatistics(statistics, expectedMode) {
  const median = statistics?.median
  const p95 = statistics?.p95
  const mad = statistics?.mad
  const relativeMad = statistics?.relativeMad
  const lower = statistics?.confidenceInterval?.lower
  const upper = statistics?.confidenceInterval?.upper

  return [
    finite(median) && median > 0,
    finite(p95) && p95 >= median,
    finite(mad) && mad >= 0,
    finite(relativeMad) && relativeMad >= 0,
    expectedMode !== 'full' || relativeMad <= 0.15,
    finite(lower),
    finite(upper),
    lower <= median,
    upper >= median,
  ].every(Boolean)
}

function approximatelyEqual(left, right) {
  return (
    finite(left) &&
    finite(right) &&
    Math.abs(left - right) <= SUMMARY_TOLERANCE * Math.max(1, Math.abs(left), Math.abs(right))
  )
}

function hasMatchingStatistics(statistics, samples) {
  const expected = summarize(samples)
  return [
    approximatelyEqual(statistics?.median, expected.median),
    approximatelyEqual(statistics?.p95, expected.p95),
    approximatelyEqual(statistics?.mad, expected.mad),
    approximatelyEqual(statistics?.relativeMad, expected.relativeMad),
    approximatelyEqual(statistics?.confidenceInterval?.lower, expected.confidenceInterval.lower),
    approximatelyEqual(statistics?.confidenceInterval?.upper, expected.confidenceInterval.upper),
  ].every(Boolean)
}

function validateBenchmarkScenario(scenario, sampleCount, expectedMode) {
  const failures = []
  if (!Number.isInteger(scenario?.attempts) || scenario.attempts < 1 || scenario.attempts > 3) {
    failures.push(`benchmark scenario attempts must be between one and three: ${scenario?.name}`)
  }
  if (!Number.isInteger(scenario?.iterations) || scenario.iterations < 1) {
    failures.push(`benchmark scenario iterations must be a positive integer: ${scenario?.name}`)
  }
  if (!hasValidSamples(scenario, sampleCount)) {
    failures.push(
      `benchmark scenario must contain ${sampleCount} positive finite samples: ${scenario?.name}`,
    )
  }
  if (
    !hasValidStatistics(scenario?.statistics, expectedMode) ||
    (hasValidSamples(scenario, sampleCount) &&
      !hasMatchingStatistics(scenario.statistics, scenario.samples))
  ) {
    failures.push(`benchmark scenario statistics are invalid or unstable: ${scenario?.name}`)
  }
  return failures
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
      scenarios.map((scenario) => scenario?.name),
      BENCHMARK_SCENARIOS,
    )
  ) {
    failures.push('benchmark must contain the nine ordered Phase 3 scenarios exactly once')
  }

  for (const scenario of scenarios) {
    failures.push(...validateBenchmarkScenario(scenario, sampleCount, expectedMode))
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
    !sameValues(sortCanonicalText(Object.keys(scenarios)), sortCanonicalText(BENCHMARK_SCENARIOS))
  ) {
    failures.push('benchmark baseline must contain exactly the nine Phase 3 scenarios')
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
