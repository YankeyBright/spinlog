import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const packageName = 'spinlog@0.2.0'
const registry = 'https://registry.npmjs.org/'
const workspace = mkdtempSync(join(tmpdir(), 'spinlog-published-signatures-'))

function npmCommand() {
  if (process.env.npm_execpath) return [process.execPath, process.env.npm_execpath]
  if (process.platform === 'win32') {
    return [process.execPath, join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')]
  }
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
    '{"name":"spinlog-signature-proof","private":true,"type":"module"}\n',
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
  npm(['audit', 'signatures', `--registry=${registry}`])
  console.log(`published-signatures=pass node=${process.version} platform=${process.platform}`)
} finally {
  rmSync(workspace, { force: true, recursive: true })
}
