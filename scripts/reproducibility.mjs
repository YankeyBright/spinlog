import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, relative, resolve } from 'node:path'

import { digestFile } from './artifact-evidence.mjs'

const npmCli = process.env.npm_execpath
const full = process.argv.includes('--full')
const ignored = new Set([
  '.agents',
  '.codex',
  '.git',
  '.vscode',
  'artifacts',
  'coverage',
  'dist',
  'docs',
  'harness',
  'node_modules',
  'temp',
])
const projectRoot = resolve('.')

function runNpm(arguments_, cwd, cache) {
  execFileSync(process.execPath, [npmCli, ...arguments_], {
    cwd,
    env: { ...process.env, npm_config_cache: cache },
    stdio: 'inherit',
    windowsHide: true,
  })
}

function copyWorkspace(destination) {
  cpSync('.', destination, {
    filter(source) {
      const first = relative(projectRoot, source).split(/[\\/]/)[0]
      return !ignored.has(first)
    },
    recursive: true,
  })
}

function buildArtifact(workspace, cache, destination, install) {
  if (install) runNpm(['ci', '--ignore-scripts'], workspace, cache)
  runNpm(['run', 'build'], workspace, cache)
  runNpm(['run', 'sbom'], workspace, cache)
  runNpm(['run', 'sbom:build'], workspace, cache)
  const packed = JSON.parse(
    execFileSync(
      process.execPath,
      [npmCli, 'pack', '--json', '--ignore-scripts', '--pack-destination', destination],
      {
        cwd: workspace,
        encoding: 'utf8',
        env: { ...process.env, npm_config_cache: cache },
        windowsHide: true,
      },
    ),
  )
  const filename = packed[0]?.filename
  if (typeof filename !== 'string') throw new Error('npm pack did not produce a tarball')
  cpSync(join(workspace, 'dist'), join(destination, 'dist'), { recursive: true })
  cpSync(join(workspace, 'sbom.json'), join(destination, 'sbom.json'))
  cpSync(join(workspace, 'artifacts/phase3/build-sbom.json'), join(destination, 'build-sbom.json'))
  return join(destination, filename)
}

function compare(left, right) {
  const names = [
    'build-sbom.json',
    'sbom.json',
    'dist/index.d.ts',
    'dist/index.js',
    'dist/index.js.map',
    'dist/styles.d.ts',
    'dist/styles.js',
    'dist/styles.js.map',
  ]
  const failures = names
    .filter(
      (name) =>
        JSON.stringify(digestFile(join(left, name))) !==
        JSON.stringify(digestFile(join(right, name))),
    )
    .map((name) => `non-reproducible approved artifact: ${name}`)
  const leftTarball = readdirSync(left).find((name) => name.endsWith('.tgz'))
  const rightTarball = readdirSync(right).find((name) => name.endsWith('.tgz'))
  if (
    !leftTarball ||
    !rightTarball ||
    JSON.stringify(digestFile(join(left, leftTarball))) !==
      JSON.stringify(digestFile(join(right, rightTarball)))
  ) {
    failures.push('non-reproducible tarball')
  }
  return failures
}

if (!npmCli) throw new Error('reproducibility checks must run through npm')
const workspace = mkdtempSync(join(tmpdir(), 'spinlog-reproducibility-'))
const first = join(workspace, 'first')
const second = join(workspace, 'second')
const firstCache = join(workspace, 'first-npm-cache')
const secondCache = join(workspace, 'second-npm-cache')
mkdirSync(first)
mkdirSync(second)

try {
  if (full) {
    const leftWorkspace = join(workspace, 'left-workspace')
    const rightWorkspace = join(workspace, 'right-workspace')
    copyWorkspace(leftWorkspace)
    copyWorkspace(rightWorkspace)
    buildArtifact(leftWorkspace, firstCache, first, true)
    buildArtifact(rightWorkspace, secondCache, second, true)
  } else {
    buildArtifact('.', firstCache, first, false)
    buildArtifact('.', secondCache, second, false)
  }

  const failures = compare(first, second)
  if (failures.length > 0) throw new Error(failures.join('\n'))
  console.log(`reproducibility=${full ? 'clean-path-pass' : 'fast-pass'}`)
} finally {
  if (basename(workspace).startsWith('spinlog-reproducibility-') && existsSync(workspace)) {
    rmSync(workspace, { force: true, recursive: true })
  }
}
