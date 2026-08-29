import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  digestReleaseTarball,
  findReleaseTarball,
  resolveReleaseDirectory,
} from './create-release-manifest.mjs'

const EXPECTED = Object.freeze({
  package: 'spinlog',
  version: '0.2.0',
  tag: 'v0.2.0',
  distTag: 'next',
  registry: 'https://registry.npmjs.org/',
  repository: 'YankeyBright/spinlog',
  schemaVersion: 1,
})

export function verifyReleaseArtifact(argument = join('artifacts', 'release')) {
  const directory = resolveReleaseDirectory(argument)
  const manifestPath = join(directory, 'release-manifest.json')
  if (!existsSync(manifestPath)) throw new Error('release artifact manifest is missing')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  for (const [key, value] of Object.entries(EXPECTED)) {
    if (manifest[key] !== value) throw new Error(`release artifact manifest ${key} is invalid`)
  }
  if (!/^[0-9a-f]{40}$/u.test(manifest.gitCommit ?? '')) {
    throw new Error('release artifact manifest gitCommit is invalid')
  }
  const tarball = findReleaseTarball(directory)
  const digest = digestReleaseTarball(tarball)
  if (manifest.tarball?.path !== 'artifacts/release/spinlog-0.2.0.tgz') {
    throw new Error('release artifact manifest tarball path is invalid')
  }
  for (const key of ['bytes', 'sha256', 'integrity']) {
    if (manifest.tarball?.[key] !== digest[key]) {
      throw new Error(`release artifact ${key} does not match its manifest`)
    }
  }
  return manifest
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  try {
    verifyReleaseArtifact(process.argv[2])
    console.log('release-artifact=verified')
  } catch (error) {
    console.error(`release-artifact: ${error.message}`)
    process.exitCode = 1
  }
}
