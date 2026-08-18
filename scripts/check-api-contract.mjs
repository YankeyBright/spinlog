import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

if (!update) {
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
  const report = readFileSync(path, 'utf8')
  const declaration = report.match(/```ts\r?\n([\s\S]*?)\r?\n```/u)?.[1]
  if (declaration === undefined) {
    throw new Error(`API report does not contain a TypeScript declaration block: ${path}`)
  }

  const tokens = []
  let index = 0
  while (index < declaration.length) {
    const character = declaration[index]
    const next = declaration[index + 1]

    if (/\s/u.test(character) || character === ';') {
      index += 1
      continue
    }
    if (character === '/' && next === '/') {
      index = declaration.indexOf('\n', index + 2)
      if (index === -1) break
      continue
    }
    if (character === '/' && next === '*') {
      const end = declaration.indexOf('*/', index + 2)
      if (end === -1) throw new Error(`Unterminated block comment in API report: ${path}`)
      index = end + 2
      continue
    }
    if (character === "'" || character === '"' || character === '`') {
      const quote = character
      let value = ''
      index += 1
      while (index < declaration.length && declaration[index] !== quote) {
        if (declaration[index] === '\\' && index + 1 < declaration.length) {
          value += declaration[index + 1]
          index += 2
        } else {
          value += declaration[index]
          index += 1
        }
      }
      if (declaration[index] !== quote)
        throw new Error(`Unterminated string in API report: ${path}`)
      tokens.push(`string:${value}`)
      index += 1
      continue
    }
    if (/[A-Za-z_$]/u.test(character)) {
      const start = index
      index += 1
      while (index < declaration.length && /[A-Za-z0-9_$]/u.test(declaration[index])) index += 1
      tokens.push(`word:${declaration.slice(start, index)}`)
      continue
    }
    if (/[0-9]/u.test(character)) {
      const start = index
      index += 1
      while (index < declaration.length && /[0-9A-Za-z_.]/u.test(declaration[index])) index += 1
      tokens.push(`number:${declaration.slice(start, index)}`)
      continue
    }
    if (!(character === '|' && tokens.at(-1) === 'punctuation:=')) {
      tokens.push(`punctuation:${character}`)
    }
    index += 1
  }
  return tokens
}
