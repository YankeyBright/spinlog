import { execFileSync } from 'node:child_process'

const npmCli = process.env.npm_execpath

if (!npmCli) {
  throw new Error('check-phases.mjs must run through npm')
}

const phases = [
  ['phase0', 'check:phase0'],
  ['phase1', 'check:phase1'],
  ['phase1Release', 'check:phase1:release'],
  ['phase2', 'check:phase2'],
  ['phase3', 'check:phase3'],
  ['phase4', 'check:phase4'],
]
const summary = {}

for (const [phase, script] of phases) {
  try {
    execFileSync(process.execPath, [npmCli, 'run', script], { stdio: 'inherit' })
  } catch {
    console.error(JSON.stringify({ phase, status: 'fail' }))
    process.exit(1)
  }

  summary[phase] = 'pass'
}

console.log(JSON.stringify(summary))
