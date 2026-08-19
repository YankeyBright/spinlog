import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { normalizeSbom, validateRawRuntimeSbom, validateSbom } from './sbom-policy.mjs'

const NPM_SBOM_ARGUMENTS = Object.freeze([
  'sbom',
  '--package-lock-only',
  '--omit=dev',
  '--omit=optional',
  '--omit=peer',
  '--sbom-format=cyclonedx',
  '--sbom-type=library',
])

export function generateSbom({ npmExecPath = process.env.npm_execpath } = {}) {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
  const raw = runNpmSbom(NPM_SBOM_ARGUMENTS, npmExecPath)
  const rawFailures = validateRawRuntimeSbom(raw, packageJson)
  if (rawFailures.length > 0) {
    throw new Error(`npm produced a non-runtime SBOM:\n${rawFailures.join('\n')}`)
  }

  const bom = normalizeSbom(raw, packageJson)
  const failures = validateSbom(bom, packageJson)

  if (failures.length > 0) {
    throw new Error(failures.join('\n'))
  }

  writeFileSync('sbom.json', `${JSON.stringify(bom, null, 2)}\n`)
}

export function runNpmSbom(arguments_, npmExecPath = process.env.npm_execpath) {
  if (!npmExecPath) {
    throw new Error('npm_execpath is required; run this generator through npm run sbom')
  }

  const result = spawnSync(process.execPath, [npmExecPath, ...arguments_], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `npm sbom exited with status ${result.status}`)
  }
  return JSON.parse(result.stdout)
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  try {
    generateSbom()
    console.log('sbom=generated')
  } catch (error) {
    console.error(`sbom: ${error.message}`)
    process.exit(1)
  }
}

export { NPM_SBOM_ARGUMENTS }
