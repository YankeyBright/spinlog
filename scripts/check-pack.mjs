import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { validatePackOutput } from './pack-policy.mjs'

const npmCli = process.env.npm_execpath

if (!npmCli) throw new Error('check-pack.mjs must run through npm')

const cache = mkdtempSync(join(tmpdir(), 'spinlog-pack-check-'))

function selectPackResult(parsed) {
  if (Array.isArray(parsed)) return parsed[0]
  if (parsed.files) return parsed
  return Object.values(parsed)[0]
}

try {
  const output = execFileSync(
    process.execPath,
    [npmCli, 'pack', '--dry-run', '--json', '--ignore-scripts'],
    {
      encoding: 'utf8',
      env: { ...process.env, npm_config_cache: cache },
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  )
  const parsed = JSON.parse(output)
  const failures = validatePackOutput(parsed)

  if (failures.length > 0) {
    for (const failure of failures) console.error(`pack: ${failure}`)
    process.exitCode = 1
  } else {
    const pack = selectPackResult(parsed)
    console.log(`pack=valid files=${pack.files.length}`)
  }
} finally {
  rmSync(cache, { force: true, recursive: true })
}
