import { inspectRuntimeDirectory, validateRuntimePolicy } from './runtime-policy.mjs'

const inspected = inspectRuntimeDirectory('src')
const failures = [...inspected.failures, ...validateRuntimePolicy(inspected.files)]

if (failures.length > 0) {
  for (const failure of failures) console.error(`runtime-policy: ${failure}`)
  process.exitCode = 1
} else {
  console.log('runtime-policy=valid')
}
