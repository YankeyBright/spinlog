import { existsSync, readFileSync } from 'node:fs'

import { DOCUMENT_PATHS, validatePhase0Contract } from './phase0-contract-policy.mjs'

const failures = []

function readText(path) {
  if (!existsSync(path)) {
    failures.push(`missing required file: ${path}`)
    return ''
  }

  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    failures.push(`could not read ${path}: ${error.message}`)
    return ''
  }
}

function readObject(path) {
  try {
    const value = JSON.parse(readText(path))

    if (value === null || Array.isArray(value) || typeof value !== 'object') {
      failures.push(`${path} must contain a JSON object`)
      return {}
    }

    return value
  } catch (error) {
    failures.push(`${path} must contain valid JSON: ${error.message}`)
    return {}
  }
}

const contract = readObject('specs/v1-behavior.json')
const declaration = readText('specs/v1-public-api.d.ts')
const stylesDeclaration = readText('specs/v1-styles-api.d.ts')
const packageJson = readObject('package.json')
const documents = Object.fromEntries(DOCUMENT_PATHS.map((path) => [path, readText(path)]))

if (process.env.GITHUB_ACTIONS === 'true') {
  if (process.env.GITHUB_REPOSITORY !== 'YankeyBright/spinlog') {
    failures.push('GitHub Actions repository must be YankeyBright/spinlog')
  }

  if (process.env.EXPECTED_REPOSITORY !== 'YankeyBright/spinlog') {
    failures.push('workflow expected repository must be YankeyBright/spinlog')
  }

  if (process.env.REPOSITORY_PRIVATE !== 'false') {
    failures.push('GitHub repository must be public for npm provenance')
  }
}

failures.push(
  ...validatePhase0Contract({ contract, declaration, stylesDeclaration, packageJson, documents }),
)

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`phase0: ${failure}`)
  }
  process.exit(1)
}

console.log('phase0=pass')
