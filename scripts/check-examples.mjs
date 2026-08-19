import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

import { DOCUMENTED_EXAMPLES } from './documentation-policy.mjs'

const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('check-examples.mjs must run through npm')

const workspace = mkdtempSync(join(tmpdir(), 'spinlog-examples-'))
const consumer = join(workspace, 'consumer')
const cache = join(workspace, 'npm-cache')
const environment = { ...process.env, CI: '1', FORCE_COLOR: '0', NODE_ENV: 'production' }
delete environment.NO_COLOR
delete environment.NODE_DISABLE_COLORS
mkdirSync(consumer)

try {
  const packed = JSON.parse(
    execFileSync(
      process.execPath,
      [npmCli, 'pack', '--json', '--ignore-scripts', '--pack-destination', workspace],
      { encoding: 'utf8', env: { ...environment, npm_config_cache: cache }, windowsHide: true },
    ),
  )
  const filename = packed[0]?.filename
  if (typeof filename !== 'string') throw new Error('npm pack did not return one tarball')

  writeFileSync(
    join(consumer, 'package.json'),
    `${JSON.stringify({ name: 'spinlog-documentation-proof', private: true, type: 'module' })}\n`,
  )
  execFileSync(
    process.execPath,
    [
      npmCli,
      'install',
      '--ignore-scripts',
      '--omit=dev',
      '--no-audit',
      '--no-fund',
      join(workspace, filename),
    ],
    { cwd: consumer, env: { ...environment, npm_config_cache: cache }, stdio: 'inherit' },
  )

  for (const { path } of DOCUMENTED_EXAMPLES) {
    const target = join(consumer, basename(path))
    copyFileSync(path, target)
    const result = spawnSync(process.execPath, [target], {
      cwd: consumer,
      encoding: 'utf8',
      env: environment,
      timeout: 5_000,
      windowsHide: true,
    })
    if (result.status !== 0 || result.error) {
      throw new Error(`${path} failed against the packed package: ${result.stderr || result.error}`)
    }
    if (result.stdout !== '') throw new Error(`${path} wrote unexpected stdout`)
  }

  console.log(`examples=pass packed=${DOCUMENTED_EXAMPLES.length}`)
} finally {
  rmSync(workspace, { force: true, recursive: true })
}
