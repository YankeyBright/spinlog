import { execFileSync } from 'node:child_process'

const npmCli = process.env.npm_execpath

if (!npmCli) {
  throw new Error('check-pack.mjs must run through npm')
}

const output = execFileSync(process.execPath, [npmCli, 'pack', '--dry-run', '--json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
})
const [pack] = JSON.parse(output)
const allowedRootFiles = new Set(['package.json', 'README.md', 'LICENSE', 'SECURITY.md', 'sbom.json'])
const requiredFiles = [
  'package.json',
  'README.md',
  'LICENSE',
  'SECURITY.md',
  'sbom.json',
  'dist/index.js',
  'dist/index.d.ts',
]
const packagedFiles = pack.files.map(({ path }) => path)
const unexpectedFiles = packagedFiles
  .filter((path) => !path.startsWith('dist/') && !allowedRootFiles.has(path))
const missingFiles = requiredFiles.filter((path) => !packagedFiles.includes(path))

if (unexpectedFiles.length > 0 || missingFiles.length > 0) {
  if (unexpectedFiles.length > 0) {
    console.error(`unexpected package files: ${unexpectedFiles.join(', ')}`)
  }
  if (missingFiles.length > 0) {
    console.error(`missing package files: ${missingFiles.join(', ')}`)
  }
  process.exit(1)
}

console.log(`pack=valid files=${pack.files.length}`)
