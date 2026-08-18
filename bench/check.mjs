import { existsSync, readFileSync } from 'node:fs'

import { BENCHMARK_SCENARIOS, validateBaseline, validateBenchmarkResult } from './policy.mjs'

const resultPath = 'artifacts/phase3/benchmark.json'
const baselinePath = 'bench/baseline.json'
const result = JSON.parse(readFileSync(resultPath, 'utf8'))
const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : null
const failures = []
const warnings = []
const scenarios = Array.isArray(result.scenarios) ? result.scenarios : []

failures.push(...validateBenchmarkResult(result, 'full'))
failures.push(...validateBaseline(baseline))
if (result.platform !== 'linux' || !String(result.node ?? '').startsWith('v24.')) {
  failures.push('candidate benchmark must run on Node 24 Linux')
}

for (const scenario of scenarios) {
  const reference = baseline?.scenarios?.[scenario.name]
  if (!reference) {
    failures.push(`benchmark baseline is missing scenario: ${scenario.name}`)
    continue
  }
  if (
    !Number.isFinite(scenario.statistics?.median) ||
    !Number.isFinite(scenario.statistics?.confidenceInterval?.lower) ||
    !Number.isFinite(reference.median) ||
    !Number.isFinite(reference.confidenceInterval?.upper)
  ) {
    failures.push(`benchmark scenario contains invalid statistics: ${scenario.name}`)
    continue
  }
  const ratio = scenario.statistics.median / reference.median
  const nonOverlapping =
    scenario.statistics.confidenceInterval.lower > reference.confidenceInterval.upper
  if (ratio > 1.25 && nonOverlapping)
    warnings.push(`${scenario.name} median regressed ${(ratio * 100 - 100).toFixed(1)}%`)
  if (ratio > 2 && scenario.statistics.confidenceInterval.lower > reference.median * 1.5) {
    failures.push(`${scenario.name} exceeds the candidate regression threshold`)
  }
}

for (const name of BENCHMARK_SCENARIOS) {
  if (!scenarios.some((scenario) => scenario.name === name)) {
    failures.push(`benchmark result is missing scenario: ${name}`)
  }
}

for (const warning of warnings) console.warn(`benchmark: warning: ${warning}`)
if (failures.length > 0) {
  for (const failure of failures) console.error(`benchmark: ${failure}`)
  process.exitCode = 1
} else {
  console.log('benchmark=valid')
}
