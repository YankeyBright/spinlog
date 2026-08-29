import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { writeCanonicalJson } from './artifact-evidence.mjs'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ARTIFACT_ROOT = join(PROJECT_ROOT, 'artifacts')
const EXPECTED = Object.freeze({
  package: 'spinlog',
  version: '0.2.0',
  tag: 'v0.2.0',
  distTag: 'next',
  registry: 'https://registry.npmjs.org/',
  repository: 'YankeyBright/spinlog',
})

export function resolveReleaseDirectory(argument = join('artifacts', 'release')) {
  if (!existsSync(ARTIFACT_ROOT)) throw new Error('release artifact root is missing')
  const artifactRoot = resolve(ARTIFACT_ROOT)
  const directory = resolve(PROJECT_ROOT, argument)
  if (!isDescendant(artifactRoot, directory)) {
    throw new Error('release artifact directory must stay inside artifacts/')
  }
  if (!existsSync(directory)) mkdirSync(directory, { recursive: true })
  return directory
}

export function findReleaseTarball(directory) {
  const tarballs = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tgz'))
    .map((entry) => entry.name)
  if (tarballs.length !== 1) {
    throw new Error(`release artifact must contain exactly one tarball, found ${tarballs.length}`)
  }
  const tarball = join(directory, tarballs[0])
  if (tarballs[0] !== 'spinlog-0.2.0.tgz') {
    throw new Error(`release artifact tarball must be ${EXPECTED.package}-${EXPECTED.version}.tgz`)
  }
  return tarball
}

export function requireReleaseContext(environment = process.env) {
  if (environment.GITHUB_ACTIONS !== 'true') {
    throw new Error('release manifest requires GitHub Actions')
  }
  if (environment.GITHUB_REPOSITORY !== EXPECTED.repository) {
    throw new Error(`release manifest requires ${EXPECTED.repository}`)
  }
  if (environment.GITHUB_REF_NAME !== EXPECTED.tag) {
    throw new Error(`release manifest requires the ${EXPECTED.tag} tag`)
  }
  if (!/^[0-9a-f]{40}$/u.test(environment.GITHUB_SHA ?? '')) {
    throw new Error('release manifest requires a full GitHub source commit')
  }
  return environment.GITHUB_SHA
}

export function digestReleaseTarball(path) {
  const contents = readFileSync(path)
  return {
    bytes: statSync(path).size,
    sha256: createHash('sha256').update(contents).digest('hex'),
    integrity: `sha512-${createHash('sha512').update(contents).digest('base64')}`,
  }
}

function npmVersion(environment) {
  if (environment.NPM_VERSION) return environment.NPM_VERSION
  const userAgentMatch = environment.npm_config_user_agent?.match(/\bnpm\/([^\s]+)/u)
  return userAgentMatch?.[1] ?? 'unknown'
}

export function createReleaseManifest(
  argument = join('artifacts', 'release'),
  environment = process.env,
) {
  const directory = resolveReleaseDirectory(argument)
  const tarball = findReleaseTarball(directory)
  const packageJson = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8'))
  const gitCommit = requireReleaseContext(environment)
  if (packageJson.name !== EXPECTED.package || packageJson.version !== EXPECTED.version) {
    throw new Error('release manifest package identity does not match the approved target')
  }
  if (
    packageJson.publishConfig?.registry !== EXPECTED.registry ||
    packageJson.publishConfig?.tag !== EXPECTED.distTag ||
    packageJson.publishConfig?.access !== 'public' ||
    packageJson.publishConfig?.provenance !== true
  ) {
    throw new Error('release manifest publishConfig does not match the approved target')
  }
  const digest = digestReleaseTarball(tarball)
  const manifest = {
    schemaVersion: 1,
    package: EXPECTED.package,
    version: EXPECTED.version,
    tag: EXPECTED.tag,
    distTag: EXPECTED.distTag,
    registry: EXPECTED.registry,
    repository: EXPECTED.repository,
    gitCommit,
    node: process.version,
    npm: npmVersion(environment),
    tarball: {
      path: relative(PROJECT_ROOT, tarball).split(sep).join('/'),
      ...digest,
    },
  }
  const output = join(directory, 'release-manifest.json')
  writeCanonicalJson(output, manifest)
  return output
}

function isDescendant(root, path) {
  const pathFromRoot = relative(root, path)
  return pathFromRoot !== '' && pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`)
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  try {
    console.log(`release-manifest=generated path=${createReleaseManifest(process.argv[2])}`)
  } catch (error) {
    console.error(`release-manifest: ${error.message}`)
    process.exitCode = 1
  }
}
