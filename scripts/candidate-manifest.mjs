import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { digestFile, writeCanonicalJson } from './artifact-evidence.mjs'

const ARTIFACT_DIRECTORY = 'artifacts/phase3'
const GITHUB_COMMIT = /^[0-9a-f]{40}$/u
const TRUSTED_GIT_EXECUTABLE = '/usr/bin/git'

export function requireGitHubCommit(environment = process.env) {
  const commit = environment.GITHUB_SHA
  if (environment.GITHUB_ACTIONS !== 'true' || !GITHUB_COMMIT.test(commit ?? '')) {
    throw new Error('candidate evidence requires a GitHub Actions commit identity')
  }
  return commit
}

function requireCleanTrackedFiles() {
  if (process.platform !== 'linux' || !existsSync(TRUSTED_GIT_EXECUTABLE)) {
    throw new Error('candidate evidence requires the trusted Linux CI Git executable')
  }
  const changes = execFileSync(
    TRUSTED_GIT_EXECUTABLE,
    ['-c', 'core.fsmonitor=false', 'status', '--porcelain', '--untracked-files=no'],
    { encoding: 'utf8', windowsHide: true },
  ).trim()
  if (changes) throw new Error('candidate evidence requires a clean tracked Git checkout')
}

function onlyTarball() {
  const tarballs = readdirSync(ARTIFACT_DIRECTORY).filter((name) => name.endsWith('.tgz'))
  if (tarballs.length !== 1) throw new Error('candidate evidence must contain exactly one tarball')
  return join(ARTIFACT_DIRECTORY, tarballs[0])
}

export function writeCandidateManifest() {
  requireCleanTrackedFiles()
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
  const files = {
    benchmark: join(ARTIFACT_DIRECTORY, 'benchmark.json'),
    benchmarkBaseline: 'bench/baseline.json',
    buildSbom: join(ARTIFACT_DIRECTORY, 'build-sbom.json'),
    runtimeSbom: 'sbom.json',
    tarball: onlyTarball(),
  }
  for (const path of Object.values(files)) {
    if (!existsSync(path)) throw new Error(`candidate evidence is missing: ${path}`)
  }

  if (!process.env.npm_execpath) throw new Error('candidate manifest must run through npm')
  const npm = execFileSync(process.execPath, [process.env.npm_execpath, '--version'], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim()
  const manifest = {
    files: Object.fromEntries(
      Object.entries(files).map(([name, path]) => [name, { path, ...digestFile(path) }]),
    ),
    gitCommit: requireGitHubCommit(),
    node: process.version,
    npm,
    schemaVersion: 1,
    version: packageJson.version,
  }
  const output = join(ARTIFACT_DIRECTORY, 'candidate-manifest.json')
  mkdirSync(ARTIFACT_DIRECTORY, { recursive: true })
  writeCanonicalJson(output, manifest)
  return output
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  try {
    console.log(`candidate-manifest=generated path=${writeCandidateManifest()}`)
  } catch (error) {
    console.error(`candidate-manifest: ${error.message}`)
    process.exitCode = 1
  }
}
