import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const packageName = 'spinlog@0.2.0'
const registry = 'https://registry.npmjs.org/'
const workspace = mkdtempSync(join(tmpdir(), 'spinlog-published-preview-'))

function npmCommand() {
  if (process.env.npm_execpath) return [process.execPath, process.env.npm_execpath]
  if (process.platform === 'win32')
    return [process.execPath, join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')]
  return ['npm']
}

function npm(arguments_) {
  const [command, ...prefix] = npmCommand()
  execFileSync(command, [...prefix, ...arguments_], {
    cwd: workspace,
    env: { ...process.env, npm_config_cache: join(workspace, 'npm-cache') },
    stdio: 'inherit',
    windowsHide: true,
  })
}

try {
  writeFileSync(
    join(workspace, 'package.json'),
    '{"name":"spinlog-published-proof","private":true,"type":"module"}\n',
  )
  npm([
    'install',
    '--ignore-scripts',
    '--omit=dev',
    '--no-audit',
    '--no-fund',
    '--registry',
    registry,
    packageName,
  ])
  writeFileSync(
    join(workspace, 'verify.mjs'),
    `import spinlog from 'spinlog'
import { red } from 'spinlog/styles'
if (red('value') !== 'value') throw new Error('published NO_COLOR policy failed')
spinlog.intro('Published')
spinlog('Working', { spinner: 'line' }).start().succeed('Done')
spinlog.outro('Verified')
`,
  )
  const result = spawnSync(process.execPath, ['verify.mjs'], {
    cwd: workspace,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: '1',
      NODE_ENV: 'production',
      NODE_DISABLE_COLORS: '',
      NPM_CONFIG_REGISTRY: registry,
    },
    timeout: 10_000,
    windowsHide: true,
  })
  if (result.status !== 0 || result.error) throw new Error(result.stderr || String(result.error))
  if (result.stdout !== '') throw new Error('published package wrote unexpected stdout')
  if (!result.stderr.includes('Published') || !result.stderr.includes('Verified')) {
    throw new Error(`published package output was incomplete: ${JSON.stringify(result.stderr)}`)
  }
  const installed = JSON.parse(
    readFileSync(join(workspace, 'node_modules/spinlog/package.json'), 'utf8'),
  )
  if (Object.keys(installed.dependencies ?? {}).length !== 0)
    throw new Error('published package has runtime dependencies')
  console.log(`published-consumer=pass node=${process.version} platform=${process.platform}`)
} finally {
  rmSync(workspace, { force: true, recursive: true })
}
