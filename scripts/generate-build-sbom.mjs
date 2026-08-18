import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { runNpmSbom } from './generate-sbom.mjs'
import { normalizeBuildSbom, validateBuildSbom } from './sbom-policy.mjs'

export const BUILD_SBOM_PATH = 'artifacts/phase3/build-sbom.json'
export const BUILD_NPM_SBOM_ARGUMENTS = Object.freeze([
  'sbom',
  '--package-lock-only',
  '--sbom-format=cyclonedx',
  '--sbom-type=library',
])

export function generateBuildSbom({ npmExecPath = process.env.npm_execpath } = {}) {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
  const bom = normalizeBuildSbom(runNpmSbom(BUILD_NPM_SBOM_ARGUMENTS, npmExecPath), packageJson)
  const failures = validateBuildSbom(bom, packageJson)

  if (failures.length > 0) throw new Error(failures.join('\n'))
  mkdirSync(dirname(resolve(BUILD_SBOM_PATH)), { recursive: true })
  writeFileSync(BUILD_SBOM_PATH, `${JSON.stringify(bom, null, 2)}\n`)
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url

if (isMain) {
  try {
    generateBuildSbom()
    console.log('build-sbom=generated')
  } catch (error) {
    console.error(`build-sbom: ${error.message}`)
    process.exitCode = 1
  }
}
