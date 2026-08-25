import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { semanticTokensFromReport } from './api-report-policy.mjs'

const extractor = resolve('node_modules/@microsoft/api-extractor/bin/api-extractor')
const update = process.argv.includes('--update')
const contractConfigurations = [
  'api-extractor.root.contract.json',
  'api-extractor.styles.contract.json',
]
const distributionConfigurations = [
  'api-extractor.root.dist.json',
  'api-extractor.styles.dist.json',
]

if (!existsSync(extractor)) {
  throw new Error(
    'API Extractor is missing; install development dependencies with npm ci --ignore-scripts',
  )
}

mkdirSync('etc', { recursive: true })
mkdirSync('temp/api-extractor/dist-reports', { recursive: true })

for (const config of contractConfigurations) {
  execFileSync(
    process.execPath,
    [extractor, 'run', '--config', config, ...(update ? ['--local'] : [])],
    {
      stdio: 'inherit',
    },
  )
}

if (update) {
  // API Extractor stages changed reports; copy only those deterministic contract artifacts.
  for (const [source, destination] of [
    ['temp/api-extractor/root-contract/spinlog.api.md', 'etc/spinlog.api.md'],
    ['temp/api-extractor/styles-contract/spinlog-styles.api.md', 'etc/spinlog-styles.api.md'],
  ]) {
    copyFileSync(source, destination)
  }
} else {
  for (const config of distributionConfigurations) {
    execFileSync(process.execPath, [extractor, 'run', '--config', config, '--local'], {
      stdio: 'inherit',
    })
  }

  compareSemanticReport('etc/spinlog.api.md', 'temp/api-extractor/dist-reports/spinlog.api.md')
  compareSemanticReport(
    'etc/spinlog-styles.api.md',
    'temp/api-extractor/dist-reports/spinlog-styles.api.md',
  )
}

console.log(`api-contract=${update ? 'updated' : 'pass'}`)

function compareSemanticReport(contractPath, distributionPath) {
  const contract = semanticTokens(contractPath)
  const distribution = semanticTokens(distributionPath)
  const length = Math.max(contract.length, distribution.length)

  for (let index = 0; index < length; index += 1) {
    if (contract[index] !== distribution[index]) {
      throw new Error(
        `API contract drift in ${distributionPath} at semantic token ${index}: expected ${JSON.stringify(contract[index])}, received ${JSON.stringify(distribution[index])}`,
      )
    }
  }
}

function semanticTokens(path) {
  return semanticTokensFromReport(readFileSync(path, 'utf8'), path)
}
