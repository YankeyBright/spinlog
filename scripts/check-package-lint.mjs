import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const cache = mkdtempSync(join(tmpdir(), 'spinlog-package-lint-'))
const environment = { ...process.env, npm_config_cache: cache }

try {
  execFileSync(process.execPath, [resolve('node_modules/publint/src/cli.js'), '.'], {
    env: environment,
    stdio: 'inherit',
  })
  execFileSync(
    process.execPath,
    [
      resolve('node_modules/@arethetypeswrong/cli/dist/index.js'),
      '--pack',
      '.',
      '--profile',
      'esm-only',
    ],
    { env: environment, stdio: 'inherit' },
  )
} finally {
  rmSync(cache, { force: true, recursive: true })
}

console.log('package-lint=pass')
