import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { stderr } from 'node:process'

import { BENCHMARK_SCHEMA_VERSION, BENCHMARK_SCENARIOS } from './policy.mjs'
import { summarize } from './statistics.mjs'

const OUTPUT_PATH = 'artifacts/phase3/benchmark.json'
const smoke = process.argv.includes('--smoke')
const sampleCount = smoke ? 5 : 30
const warmupCount = smoke ? 1 : 5

function now() {
  return process.hrtime.bigint()
}

function elapsed(start) {
  return Number(now() - start)
}

function withEnvironment(values, operation) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  Object.assign(process.env, values)
  try {
    return operation()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

async function withSilentStderr(operation) {
  const write = stderr.write
  stderr.write = () => true
  try {
    return await operation()
  } finally {
    stderr.write = write
  }
}

function calibrate(operation) {
  let iterations = 1
  while (iterations < 1 << 20) {
    const start = now()
    for (let index = 0; index < iterations; index += 1) operation()
    if (elapsed(start) >= 10_000_000) return iterations
    iterations *= 2
  }
  return iterations
}

function measureSync(operation) {
  const iterations = calibrate(operation)
  for (let index = 0; index < warmupCount; index += 1) {
    for (let repeat = 0; repeat < iterations; repeat += 1) operation()
  }
  const samples = Array.from({ length: sampleCount }, () => {
    const start = now()
    for (let repeat = 0; repeat < iterations; repeat += 1) operation()
    return elapsed(start) / iterations
  })
  return { iterations, samples }
}

async function measureAsync(operation) {
  const iterations = smoke ? 10 : 100
  for (let index = 0; index < warmupCount; index += 1) {
    for (let repeat = 0; repeat < iterations; repeat += 1) await operation()
  }
  const samples = []
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const start = now()
    for (let repeat = 0; repeat < iterations; repeat += 1) await operation()
    samples.push(elapsed(start) / iterations)
  }
  return { iterations, samples }
}

function coldImport(entry) {
  const start = now()
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', `await import(${JSON.stringify(entry)})`],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  )
  if (result.status !== 0 || result.error) throw new Error(result.stderr || String(result.error))
  return elapsed(start)
}

async function measureColdImport(entry) {
  for (let index = 0; index < warmupCount; index += 1) coldImport(entry)
  const samples = []
  for (let sample = 0; sample < sampleCount; sample += 1) samples.push(coldImport(entry))
  return { iterations: 1, samples }
}

async function stableMeasurement(name, measure) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await measure()
    const statistics = summarize(result.samples)
    if (smoke || statistics.relativeMad <= 0.15) {
      return { attempts: attempt, name, ...result, statistics }
    }
  }
  throw new Error(`${name} exceeded 15% relative median absolute deviation after three attempts`)
}

const root = new URL('../dist/index.js', import.meta.url).href
const styles = new URL('../dist/styles.js', import.meta.url).href
const styleModule = await import(styles)
const rootModule = await import(root)

const scenarios = [
  await stableMeasurement('root-cold-import-ns', () => measureColdImport(root)),
  await stableMeasurement('styles-cold-import-ns', () => measureColdImport(styles)),
  await stableMeasurement('enabled-style-ns', () =>
    withEnvironment(
      { FORCE_COLOR: '1', NO_COLOR: '', NODE_DISABLE_COLORS: '', NODE_ENV: 'production' },
      () => measureSync(() => styleModule.red('spinlog')),
    ),
  ),
  await stableMeasurement('disabled-style-ns', () =>
    withEnvironment(
      { FORCE_COLOR: '1', NO_COLOR: '1', NODE_DISABLE_COLORS: '', NODE_ENV: 'production' },
      () => measureSync(() => styleModule.red('spinlog')),
    ),
  ),
  await stableMeasurement('static-spinner-settlement-ns', () =>
    withSilentStderr(() =>
      withEnvironment({ CI: '1', FORCE_COLOR: '0', NO_COLOR: '1', NODE_ENV: 'production' }, () =>
        measureSync(() => rootModule.default('benchmark').start().succeed()),
      ),
    ),
  ),
  await stableMeasurement('custom-spinner-settlement-ns', () =>
    withSilentStderr(() =>
      withEnvironment({ CI: '1', FORCE_COLOR: '0', NO_COLOR: '1', NODE_ENV: 'production' }, () =>
        measureSync(() =>
          rootModule
            .default('benchmark', {
              spinner: { frames: ['-', '+'], interval: 80 },
            })
            .start()
            .succeed(),
        ),
      ),
    ),
  ),
  await stableMeasurement('resolved-promise-wrapper-ns', () =>
    withSilentStderr(() =>
      withEnvironment({ CI: '1', FORCE_COLOR: '0', NO_COLOR: '1', NODE_ENV: 'production' }, () =>
        measureAsync(() => rootModule.default.promise(Promise.resolve('benchmark'))),
      ),
    ),
  ),
  await stableMeasurement('intro-flow-message-ns', () =>
    withSilentStderr(() =>
      withEnvironment({ CI: '1', FORCE_COLOR: '0', NO_COLOR: '1', NODE_ENV: 'production' }, () =>
        measureSync(() => rootModule.default.intro('benchmark')),
      ),
    ),
  ),
  await stableMeasurement('outro-flow-message-ns', () =>
    withSilentStderr(() =>
      withEnvironment({ CI: '1', FORCE_COLOR: '0', NO_COLOR: '1', NODE_ENV: 'production' }, () =>
        measureSync(() => rootModule.default.outro('benchmark')),
      ),
    ),
  ),
  await stableMeasurement('instance-log-ns', () =>
    withSilentStderr(() =>
      withEnvironment({ CI: '1', FORCE_COLOR: '0', NO_COLOR: '1', NODE_ENV: 'production' }, () =>
        measureSync(() => rootModule.default('benchmark', { static: 'silent' }).log('benchmark')),
      ),
    ),
  ),
  await stableMeasurement('group-static-settlement-ns', () =>
    withSilentStderr(() =>
      withEnvironment({ CI: '1', FORCE_COLOR: '0', NO_COLOR: '1', NODE_ENV: 'production' }, () =>
        measureSync(() => {
          const group = rootModule.default.group({ terminal: 'static' })
          group.add('benchmark').start().succeed()
          group.stop()
        }),
      ),
    ),
  ),
  await stableMeasurement('progress-static-settlement-ns', () =>
    withSilentStderr(() =>
      withEnvironment({ CI: '1', FORCE_COLOR: '0', NO_COLOR: '1', NODE_ENV: 'production' }, () =>
        measureSync(() =>
          rootModule.default
            .progress('benchmark', {
              total: 1,
              terminal: 'static',
            })
            .start()
            .increment()
            .succeed(),
        ),
      ),
    ),
  ),
]

if (JSON.stringify(scenarios.map(({ name }) => name)) !== JSON.stringify(BENCHMARK_SCENARIOS)) {
  throw new Error('benchmark implementation drifted from the frozen Phase 3 scenario order')
}

mkdirSync(resolve('artifacts/phase3'), { recursive: true })
writeFileSync(
  OUTPUT_PATH,
  `${JSON.stringify(
    {
      mode: smoke ? 'smoke' : 'full',
      node: process.version,
      platform: process.platform,
      provenance: {
        commit: process.env.BENCHMARK_SOURCE_COMMIT ?? process.env.GITHUB_SHA ?? null,
        githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
        githubRunId: process.env.GITHUB_RUN_ID ?? null,
        slot: process.env.BENCHMARK_RUN_SLOT ?? null,
      },
      schemaVersion: BENCHMARK_SCHEMA_VERSION,
      scenarios,
    },
    null,
    2,
  )}\n`,
)
console.log(`benchmark=${smoke ? 'smoke' : 'full'} scenarios=${scenarios.length}`)
