import { execFileSync, spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PROJECT_ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
const ARTIFACT_ROOT = join(PROJECT_ROOT, 'artifacts')
const DEFAULT_ARTIFACT_DIRECTORY = join('artifacts', 'package')
export const PACKED_SPINNER_OUTPUTS = Object.freeze({
  nonTTY: '- Non-TTY\n+ Non-TTY done\n',
  tty: '\x1b[?25l- TTY\x1b[2K\r+ TTY done\n\x1b[?25h',
})

/** Resolve a CLI artifact directory only when its canonical path stays under artifacts/. */
export function resolveArtifactDirectory(argument, projectRoot, artifactRoot) {
  const canonicalProjectRoot = realpathSync(projectRoot)
  const canonicalArtifactRoot = realpathSync(artifactRoot)
  const candidate = realpathSync(resolve(canonicalProjectRoot, argument))
  return requireArtifactDescendant(candidate, canonicalArtifactRoot, 'artifact directory')
}

/** Select the one regular package tarball without following symlinks out of the directory. */
export function findPackedTarball(artifactDirectory) {
  const tarballs = readdirSync(artifactDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tgz'))
    .map((entry) => entry.name)
  if (tarballs.length !== 1)
    throw new Error(`expected one packed tarball, found ${tarballs.length}`)

  return requireArtifactDescendant(
    realpathSync(join(artifactDirectory, tarballs[0])),
    artifactDirectory,
    'packed tarball',
  )
}

export function verifyPackedRuntime(argument = DEFAULT_ARTIFACT_DIRECTORY) {
  const artifactDirectory = resolveArtifactDirectory(argument, PROJECT_ROOT, ARTIFACT_ROOT)
  const tarball = findPackedTarball(artifactDirectory)
  const workspace = mkdtempSync(join(tmpdir(), 'spinlog-runtime-floor-'))

  try {
    installPackedRuntime(workspace, tarball)
    verifyPackedRuntimeOutput(workspace)
    verifyDependencyFreeInstall(workspace)
    console.log(
      `packed-runtime=pass node=${process.version} platform=${process.platform} targets=spinner-non-tty,spinner-tty`,
    )
  } finally {
    rmSync(workspace, { force: true, recursive: true })
  }
}

function requireArtifactDescendant(path, artifactRoot, label) {
  if (!isArtifactDescendant(artifactRoot, path)) {
    throw new Error(`${label} must stay within the repository artifacts directory`)
  }
  return path
}

function isArtifactDescendant(artifactRoot, path) {
  const pathFromRoot = relative(artifactRoot, path)
  if (pathFromRoot === '' || pathFromRoot === '..') return false
  return !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot)
}

function installPackedRuntime(workspace, tarball) {
  const npmCli = npmCliPath()
  const npm = npmCli ? process.execPath : 'npm'
  const npmArguments = npmCli ? [npmCli] : []
  const environment = { ...process.env, npm_config_cache: join(workspace, 'npm-cache') }
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
      tarball,
    ],
    { cwd: workspace, env: environment, stdio: 'inherit', windowsHide: true },
  )
}

function npmCliPath() {
  if (process.env.npm_execpath) return process.env.npm_execpath
  if (process.platform !== 'win32') return undefined
  return join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')
}

function verifyPackedRuntimeOutput(workspace) {
  writeFileSync(
    join(workspace, 'verify.mjs'),
    `import spinlog from 'spinlog'
import { red } from 'spinlog/styles'
import { PassThrough } from 'node:stream'
process.env.FORCE_COLOR = '1'
process.env.NO_COLOR = '1'
if (red('value') !== 'value') throw new Error('NO_COLOR policy failed')
const expected = ${JSON.stringify(PACKED_SPINNER_OUTPUTS)}

async function renderSpinner(text, isTTY, terminal) {
  const target = new PassThrough()
  Object.defineProperties(target, {
    isTTY: { configurable: true, value: isTTY },
    columns: { configurable: true, value: 80 },
    rows: { configurable: true, value: 8 },
  })
  let output = ''
  target.on('data', (chunk) => { output += chunk })
  const spinner = spinlog(text, {
    stream: target,
    spinner: 'line',
    terminal,
    static: 'symbol',
    color: false,
    unicode: false,
    hideCursor: true,
  })
  spinner.start().succeed(text + ' done')
  await spinner.flush()
  return output
}

function assertSpinnerOutput(mode, output) {
  if (output !== expected[mode]) {
    throw new Error('packed ' + mode + ' spinner output mismatch: ' + JSON.stringify(output))
  }
}

assertSpinnerOutput('nonTTY', await renderSpinner('Non-TTY', false, 'auto'))
assertSpinnerOutput('tty', await renderSpinner('TTY', true, 'interactive'))
`,
  )
  const result = spawnSync(process.execPath, ['verify.mjs'], {
    cwd: workspace,
    encoding: 'utf8',
    env: runtimeEnvironment(),
    timeout: 5_000,
    windowsHide: true,
  })
  if (result.status !== 0 || result.error) throw new Error(result.stderr || String(result.error))
  if (result.stdout !== '') throw new Error('packed runtime wrote unexpected stdout')
  if (result.stderr !== '')
    throw new Error(`packed runtime wrote unexpected stderr: ${JSON.stringify(result.stderr)}`)
}

function runtimeEnvironment() {
  const environment = {
    ...process.env,
    CI: '1',
    NODE_DISABLE_COLORS: '',
    NODE_ENV: 'production',
    TERM: 'xterm-256color',
    WT_SESSION: 'packed-consumer',
  }
  delete environment.FORCE_COLOR
  delete environment.NO_COLOR
  return environment
}

/** Assert the exact terminal bytes produced by the packed Spinner smoke probe. */
export function assertPackedSpinnerOutput(mode, output) {
  const expected = PACKED_SPINNER_OUTPUTS[mode]
  if (expected === undefined) throw new Error(`unknown packed spinner mode: ${mode}`)
  if (output !== expected) {
    throw new Error(`packed ${mode} spinner output mismatch: ${JSON.stringify(output)}`)
  }
}

function verifyDependencyFreeInstall(workspace) {
  const installed = JSON.parse(
    readFileSync(join(workspace, 'node_modules/spinlog/package.json'), 'utf8'),
  )
  if (Object.keys(installed.dependencies ?? {}).length !== 0) {
    throw new Error('packed runtime installed consumer dependencies')
  }
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) verifyPackedRuntime(process.argv[2])
