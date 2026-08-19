import { describe, expect, it } from 'vitest'

import { aggregateBaseline } from '../bench/aggregate-baseline.mjs'
import {
  BENCHMARK_SCHEMA_VERSION,
  BENCHMARK_SCENARIOS,
  validateBaseline,
  validateBenchmarkResult,
} from '../bench/policy.mjs'
import {
  bootstrapMedianInterval,
  median,
  medianAbsoluteDeviation,
  percentile,
  summarize,
} from '../bench/statistics.mjs'

function benchmarkResult(slot: number) {
  const samples = Array.from({ length: 30 }, (_, index) => 100 + slot + index)
  return {
    mode: 'full',
    node: 'v24.12.0',
    platform: 'linux',
    provenance: {
      commit: 'a'.repeat(40),
      githubRunAttempt: '1',
      githubRunId: '12345',
      slot: String(slot),
    },
    schemaVersion: BENCHMARK_SCHEMA_VERSION,
    scenarios: BENCHMARK_SCENARIOS.map((name) => ({
      attempts: 1,
      iterations: 10,
      name,
      samples,
      statistics: summarize(samples),
    })),
  }
}

describe('benchmark statistics', () => {
  it('calculates deterministic robust summary statistics', () => {
    const values = [1, 2, 3, 4, 100]
    const first = summarize(values)

    expect(median(values)).toBe(3)
    expect(percentile(values, 0.95)).toBe(100)
    expect(medianAbsoluteDeviation(values)).toBe(1)
    expect(bootstrapMedianInterval(values)).toEqual(bootstrapMedianInterval(values))
    expect(first.relativeMad).toBeCloseTo(1 / 3)
  })

  it('handles zero-valued measurements without invalid dispersion', () => {
    expect(summarize([0, 0, 0]).relativeMad).toBe(0)
  })

  it('validates complete ordered benchmark evidence', () => {
    expect(validateBenchmarkResult(benchmarkResult(1), 'full')).toEqual([])

    const drifted = benchmarkResult(1)
    drifted.scenarios.reverse()
    expect(validateBenchmarkResult(drifted, 'full')).toContain(
      'benchmark must contain the six ordered Phase 3 scenarios exactly once',
    )
  })

  it('reports missing scenario statistics without throwing', () => {
    const invalid = benchmarkResult(1)
    delete (invalid.scenarios[0] as { statistics?: unknown }).statistics

    expect(validateBenchmarkResult(invalid, 'full')).toContain(
      `benchmark scenario statistics are invalid or unstable: ${invalid.scenarios[0]?.name}`,
    )
  })

  it('rejects summary statistics that do not match their samples', () => {
    const invalid = benchmarkResult(1)
    invalid.scenarios[0].statistics.median += 1

    expect(validateBenchmarkResult(invalid, 'full')).toContain(
      `benchmark scenario statistics are invalid or unstable: ${invalid.scenarios[0].name}`,
    )
  })

  it('reports malformed scenario entries as validation failures', () => {
    const invalid = benchmarkResult(1)
    invalid.scenarios[0] = null as unknown as (typeof invalid.scenarios)[number]

    expect(validateBenchmarkResult(invalid, 'full')).toContain(
      'benchmark must contain the six ordered Phase 3 scenarios exactly once',
    )
  })

  it('aggregates five uniquely identified CI artifacts into a reviewable baseline', () => {
    const baseline = aggregateBaseline(
      Array.from({ length: 5 }, (_, index) => {
        const result = benchmarkResult(index + 1)
        return { contents: JSON.stringify(result), path: `run-${index + 1}.json` }
      }),
    )

    expect(validateBaseline(baseline)).toEqual([])
    expect(baseline.provenance.inputs.map(({ slot }) => slot)).toEqual([1, 2, 3, 4, 5])
  })

  it('rejects baseline inputs that do not prove five independent matrix slots', () => {
    const inputs = Array.from({ length: 5 }, (_, index) => {
      const result = benchmarkResult(index === 4 ? 4 : index + 1)
      return { contents: JSON.stringify(result), path: `run-${index + 1}.json` }
    })

    expect(() => aggregateBaseline(inputs)).toThrow(
      'baseline inputs must come from five matrix slots in one commit and workflow attempt',
    )
  })
})
