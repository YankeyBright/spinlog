import { existsSync, readFileSync } from 'node:fs'

import { validateBaseline, validateBenchmarkResult } from '../bench/policy.mjs'

const failures = []

function readObject(path, label) {
  if (!existsSync(path)) {
    failures.push(`${label} is missing`)
    return null
  }
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'))
    if (value === null || Array.isArray(value) || typeof value !== 'object') {
      failures.push(`${label} must contain a JSON object`)
      return null
    }
    return value
  } catch (error) {
    failures.push(`${label} must contain valid JSON: ${error.message}`)
    return null
  }
}

const baseline = readObject('bench/baseline.json', 'benchmark baseline')
if (baseline) failures.push(...validateBaseline(baseline))

const result = readObject('artifacts/phase3/benchmark.json', 'benchmark smoke evidence')
if (result) failures.push(...validateBenchmarkResult(result, 'smoke'))

if (failures.length > 0) {
  for (const failure of new Set(failures)) console.error(`phase3: ${failure}`)
  process.exitCode = 1
} else {
  console.log('phase3=pass')
}
