import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const npmCli = process.env.npm_execpath
const tarball = 'artifacts/phase3/spinlog-0.1.0.tgz'
const registry = 'https://registry.npmjs.org/'

export function validatePublishedIntegrity(expected, actual) {
  return expected === actual ? [] : ['published npm integrity does not match the attested tarball']
}

function run() {
  if (!npmCli) throw new Error('published integrity verification must run through npm')
  const published = JSON.parse(
    execFileSync(
      process.execPath,
      [
        npmCli,
        'view',
        `${packageJson.name}@${packageJson.version}`,
        'dist.integrity',
        '--json',
        `--registry=${registry}`,
      ],
      { encoding: 'utf8', windowsHide: true },
    ),
  )
  const local = `sha512-${createHash('sha512').update(readFileSync(tarball)).digest('base64')}`
  const failures = validatePublishedIntegrity(local, published)

  if (failures.length > 0) {
    for (const failure of failures) console.error(`published-integrity: ${failure}`)
    process.exitCode = 1
  } else {
    console.log('published-integrity=valid')
  }
}

const invokedPath = process.argv[1]
if (invokedPath && import.meta.url === pathToFileURL(resolve(invokedPath)).href) run()
