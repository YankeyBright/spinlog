import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const artifactDirectory = resolve(process.argv[2] ?? 'artifacts/package')
const tarballs = readdirSync(artifactDirectory).filter((name) => name.endsWith('.tgz'))
if (tarballs.length !== 1) throw new Error(`expected one packed tarball, found ${tarballs.length}`)

const workspace = mkdtempSync(join(tmpdir(), 'spinlog-runtime-floor-'))
const npmCli =
  process.env.npm_execpath ??
  (process.platform === 'win32'
    ? join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
    : undefined)
const npm = npmCli ? process.execPath : 'npm'
const npmArguments = npmCli ? [npmCli] : []
const npmEnvironment = { ...process.env, npm_config_cache: join(workspace, 'npm-cache') }
try {
  writeFileSync(
    join(workspace, 'package.json'),
    `${JSON.stringify({ name: 'spinlog-runtime-floor-proof', private: true, type: 'module' })}\n`,
  )
  execFileSync(
    npm,
    [
      ...npmArguments,
      'install',
      '--ignore-scripts',
      '--omit=dev',
      '--no-audit',
      '--no-fund',
      join(artifactDirectory, tarballs[0]),
    ],
    { cwd: workspace, env: npmEnvironment, stdio: 'inherit', windowsHide: true },
  )
  writeFileSync(
    join(workspace, 'verify.mjs'),
    `import spinlog from 'spinlog'
import { red } from 'spinlog/styles'
process.env.FORCE_COLOR = '1'
process.env.NO_COLOR = '1'
if (red('value') !== 'value') throw new Error('NO_COLOR policy failed')
spinlog.intro('Consumer')
spinlog('Working', { spinner: 'line' }).start().succeed('Done')
spinlog.outro('Complete')
`,
  )
  const runtimeEnvironment = {
    ...process.env,
    CI: '1',
    NODE_DISABLE_COLORS: '',
    NODE_ENV: 'production',
    WT_SESSION: 'packed-consumer',
  }
  delete runtimeEnvironment.FORCE_COLOR
  delete runtimeEnvironment.NO_COLOR
  const result = spawnSync(process.execPath, ['verify.mjs'], {
    cwd: workspace,
    encoding: 'utf8',
    env: runtimeEnvironment,
    timeout: 5_000,
    windowsHide: true,
  })
  if (result.status !== 0 || result.error) throw new Error(result.stderr || String(result.error))
  if (result.stdout !== '') throw new Error('packed runtime wrote unexpected stdout')
  if (result.stderr !== '┌  Consumer\n- Working\n✔ Done\n└  Complete\n') {
    throw new Error(`packed runtime stderr mismatch: ${JSON.stringify(result.stderr)}`)
  }

  const installed = JSON.parse(
    readFileSync(join(workspace, 'node_modules/spinlog/package.json'), 'utf8'),
  )
  if (Object.keys(installed.dependencies ?? {}).length !== 0) {
    throw new Error('packed runtime installed consumer dependencies')
  }
  console.log(`packed-runtime=pass node=${process.version} platform=${process.platform}`)
} finally {
  rmSync(workspace, { force: true, recursive: true })
}
