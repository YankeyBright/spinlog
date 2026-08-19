import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  BASELINE_SCHEMA_VERSION,
  BENCHMARK_SCENARIOS,
  validateBaseline,
  validateBenchmarkResult,
} from './policy.mjs'
import { bootstrapMedianInterval, median } from './statistics.mjs'

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex')
}

export function aggregateBaseline(inputs) {
  if (inputs.length !== 5) throw new Error('provide exactly five benchmark inputs')

  const records = inputs.map(({ contents, path }) => ({
    digest: sha256(contents),
    path,
    result: JSON.parse(contents),
  }))
  const failures = records.flatMap(({ path, result }) =>
    validateBenchmarkResult(result, 'full').map((failure) => `${path}: ${failure}`),
  )
  if (failures.length > 0) throw new Error(failures.join('\n'))
  if (
    records.some(({ result }) => result.platform !== 'linux' || !result.node.startsWith('v24.'))
  ) {
    throw new Error('baseline inputs must be full Node 24 Linux benchmark results')
  }

  const [first] = records
  const identity = first.result.provenance
  const slots = records.map(({ result }) => Number(result.provenance?.slot))
  if (
    !/^[0-9a-f]{40}$/u.test(identity?.commit ?? '') ||
    !/^\d+$/u.test(identity?.githubRunId ?? '') ||
    !/^\d+$/u.test(identity?.githubRunAttempt ?? '') ||
    records.some(
      ({ result }) =>
        result.node !== first.result.node ||
        result.provenance?.commit !== identity.commit ||
        result.provenance?.githubRunId !== identity.githubRunId ||
        result.provenance?.githubRunAttempt !== identity.githubRunAttempt,
    ) ||
    JSON.stringify([...slots].sort((left, right) => left - right)) !==
      JSON.stringify([1, 2, 3, 4, 5])
  ) {
    throw new Error(
      'baseline inputs must come from five matrix slots in one commit and workflow attempt',
    )
  }
  if (new Set(records.map(({ digest }) => digest)).size !== 5) {
    throw new Error('baseline inputs must be five unique artifacts')
  }

  const scenarios = Object.fromEntries(
    BENCHMARK_SCENARIOS.map((name) => {
      const values = records.map(
        ({ result }) =>
          result.scenarios.find((scenario) => scenario.name === name).statistics.median,
      )
      return [name, { confidenceInterval: bootstrapMedianInterval(values), median: median(values) }]
    }),
  )
  const baseline = {
    node: first.result.node,
    platform: 'linux',
    provenance: {
      commit: identity.commit,
      githubRunAttempt: identity.githubRunAttempt,
      githubRunId: identity.githubRunId,
      inputs: records
        .map(({ digest, result }) => ({ sha256: digest, slot: Number(result.provenance.slot) }))
        .sort((left, right) => left.slot - right.slot),
    },
    runs: 5,
    scenarios,
    schemaVersion: BASELINE_SCHEMA_VERSION,
  }
  const baselineFailures = validateBaseline(baseline)
  if (baselineFailures.length > 0) throw new Error(baselineFailures.join('\n'))
  return baseline
}

function main(arguments_) {
  const outputIndex = arguments_.indexOf('--out')
  const output = outputIndex === -1 ? undefined : arguments_[outputIndex + 1]
  const paths = arguments_.filter((_, index) => index !== outputIndex && index !== outputIndex + 1)
  if (paths.length !== 5 || !output) {
    throw new Error('provide exactly five benchmark result paths and --out <path>')
  }
  const baseline = aggregateBaseline(
    paths.map((path) => ({ contents: readFileSync(path, 'utf8'), path })),
  )
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(baseline, null, 2)}\n`)
  console.log(`benchmark-baseline=generated path=${output}`)
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) main(process.argv.slice(2))
