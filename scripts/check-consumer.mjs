import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('check-consumer.mjs must run through npm')

const workspace = mkdtempSync(join(tmpdir(), 'spinlog-consumer-'))
const consumer = join(workspace, 'project')
const cache = join(workspace, 'npm-cache')
const npmEnvironment = { ...process.env, npm_config_cache: cache }
mkdirSync(consumer)

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

try {
  const packed = JSON.parse(
    execFileSync(
      process.execPath,
      [npmCli, 'pack', '--json', '--ignore-scripts', '--pack-destination', workspace],
      {
        encoding: 'utf8',
        env: npmEnvironment,
        stdio: ['ignore', 'pipe', 'inherit'],
        windowsHide: true,
      },
    ),
  )
  const filename = packed[0]?.filename
  if (typeof filename !== 'string') throw new Error('npm pack did not return a tarball filename')

  writeJson(join(consumer, 'package.json'), {
    name: 'spinlog-consumer-proof',
    private: true,
    type: 'module',
  })
  execFileSync(
    process.execPath,
    [
      npmCli,
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--cache',
      cache,
      join(workspace, filename),
    ],
    { cwd: consumer, env: npmEnvironment, stdio: 'inherit', windowsHide: true },
  )

  writeFileSync(
    join(consumer, 'smoke.mjs'),
    `import spinlog from 'spinlog'\nimport { red } from 'spinlog/styles'\nif (typeof spinlog !== 'function' || typeof red !== 'function') throw new Error('invalid exports')\nif (red('value') !== 'value') throw new Error('FORCE_COLOR=0 must disable styles')\nspinlog('consumer', { spinner: 'line' }).start().succeed('done')\n`,
  )
  const environment = {
    ...process.env,
    CI: '1',
    FORCE_COLOR: '0',
    NODE_ENV: 'production',
    WT_SESSION: 'consumer-proof',
  }
  const smoke = spawnSync(process.execPath, ['smoke.mjs'], {
    cwd: consumer,
    encoding: 'utf8',
    env: environment,
    timeout: 5_000,
  })
  if (smoke.status !== 0) throw new Error(smoke.stderr || 'packed consumer smoke test failed')
  if (smoke.stdout !== '') throw new Error('packed consumer wrote unexpected stdout')
  if (smoke.stderr !== '- consumer\n✔ done\n') {
    throw new Error(`packed consumer stderr mismatch: ${JSON.stringify(smoke.stderr)}`)
  }

  writeFileSync(
    join(consumer, 'unref.mjs'),
    `import spinlog from 'spinlog'\nObject.defineProperty(process.stderr, 'isTTY', { configurable: true, value: true })\nspinlog('active', { spinner: 'line' }).start()\n`,
  )
  const unref = spawnSync(process.execPath, ['unref.mjs'], {
    cwd: consumer,
    encoding: 'utf8',
    env: { ...environment, CI: '' },
    timeout: 5_000,
  })
  if (unref.status !== 0 || unref.error) {
    throw new Error(`unreferenced spinner prevented clean process exit: ${String(unref.error)}`)
  }
  if (unref.stdout !== '') throw new Error('interactive packed consumer wrote unexpected stdout')
  if (unref.stderr !== '\x1b[?25l- active') {
    throw new Error(`interactive packed consumer stderr mismatch: ${JSON.stringify(unref.stderr)}`)
  }

  writeFileSync(
    join(consumer, 'consumer.ts'),
    `import spinlog, { red, type Spinner } from 'spinlog'\nimport { blue } from 'spinlog/styles'\nconst spinner: Spinner = spinlog(red(blue('typed')))\nspinner.start().stop()\n`,
  )
  const baseCompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    target: 'ES2022',
  }
  const resolutions = {
    node16: { module: 'Node16', moduleResolution: 'Node16' },
    nodenext: { module: 'NodeNext', moduleResolution: 'NodeNext' },
    bundler: { module: 'ESNext', moduleResolution: 'Bundler' },
  }
  const tsc = resolve('node_modules/typescript/bin/tsc')
  for (const [name, compilerOptions] of Object.entries(resolutions)) {
    const config = join(consumer, `tsconfig.${name}.json`)
    writeJson(config, {
      compilerOptions: { ...baseCompilerOptions, ...compilerOptions },
      files: ['consumer.ts'],
    })
    execFileSync(process.execPath, [tsc, '-p', config], { cwd: consumer, stdio: 'inherit' })
  }

  const installed = JSON.parse(
    readFileSync(join(consumer, 'node_modules/spinlog/package.json'), 'utf8'),
  )
  if (installed.name !== 'spinlog') throw new Error('installed tarball identity mismatch')

  console.log('consumer=pass resolutions=node16,nodenext,bundler')
} finally {
  if (basename(workspace).startsWith('spinlog-consumer-')) {
    rmSync(workspace, { force: true, recursive: true })
  }
}
