import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { compareCanonicalText, sortCanonicalText } from './canonical-order.mjs'

export const APPROVED_RUNTIME_FILES = Object.freeze([
  'ansi.ts',
  'env.ts',
  'index.ts',
  'spinner.ts',
  'styles.ts',
])

const APPROVED_IMPORTS = Object.freeze({
  'ansi.ts': ['node:util'],
  'env.ts': [],
  'index.ts': [],
  'spinner.ts': ['node:process', 'node:util'],
  'styles.ts': ['node:util'],
})
const FORBIDDEN_RUNTIME_OPERATIONS = Object.freeze([
  [/\bprocess\.(?:on|once|addListener|prependListener)\s*\(/, 'process listener'],
  [/\bprocess\.(?:exit|kill|abort)\s*\(/, 'host termination call'],
  [/\b(?:stderr|process\.stderr)\.(?:on|once|addListener|prependListener)\s*\(/, 'stderr listener'],
  [/\b(?:stdout|process\.stdout)\.write\s*\(/, 'stdout write'],
  [/\bSIG(?:INT|TERM)\b/, 'signal ownership'],
])

function normalize(path) {
  return path.replaceAll('\\', '/')
}

export function inspectRuntimeDirectory(directory) {
  const files = []
  const failures = []

  function visit(path) {
    const entry = lstatSync(path)
    if (entry.isSymbolicLink()) {
      failures.push(
        `runtime source must not contain symlinks: ${normalize(relative(directory, path))}`,
      )
      return
    }
    if (entry.isDirectory()) {
      for (const child of readdirSync(path)) visit(join(path, child))
      return
    }
    if (!entry.isFile()) {
      failures.push(
        `runtime source must contain only regular files: ${normalize(relative(directory, path))}`,
      )
      return
    }
    const relativePath = normalize(relative(directory, path))
    if (!path.endsWith('.ts')) {
      failures.push(`runtime source must contain only approved TypeScript modules: ${relativePath}`)
      return
    }
    files.push({ path: relativePath, text: readFileSync(path, 'utf8') })
  }

  visit(directory)
  const orderedFiles = files.toSorted((left, right) => compareCanonicalText(left.path, right.path))
  return { failures, files: orderedFiles }
}

export function validateRuntimePolicy(files) {
  const failures = []
  const paths = sortCanonicalText(files.map(({ path }) => path))
  if (JSON.stringify(paths) !== JSON.stringify(APPROVED_RUNTIME_FILES)) {
    failures.push(`src must contain exactly: ${APPROVED_RUNTIME_FILES.join(', ')}`)
  }

  for (const file of files) validateRuntimeFile(file, failures)

  return [...new Set(failures)]
}

function validateRuntimeFile({ path, text }, failures) {
  validateImports(path, text, failures)
  if (/\b(?:import\s*\(|require\s*\()\s*['"]node:/.test(text)) {
    failures.push(`${path} must not dynamically load Node built-ins`)
  }
  if (hasUnapprovedProcessImport(text)) {
    failures.push(`${path} may import only stderr from node:process`)
  }
  for (const [pattern, description] of FORBIDDEN_RUNTIME_OPERATIONS) {
    if (pattern.test(text)) failures.push(`${path} must not contain ${description}`)
  }
}

function validateImports(path, text, failures) {
  const imports = [...text.matchAll(/(?:from\s+|import\s+)['"](node:[^'"]+)['"]/g)].map(
    (match) => match[1],
  )
  const approved = APPROVED_IMPORTS[path] ?? []
  for (const specifier of imports) {
    if (!approved.includes(specifier)) {
      failures.push(`${path} imports unapproved built-in: ${specifier}`)
    }
  }
}

function hasUnapprovedProcessImport(text) {
  return (
    /(?:from\s+|import\s+)['"]node:process['"]/.test(text) &&
    !/^import\s+\{\s*stderr\s*\}\s+from\s+['"]node:process['"]\s*;?\s*$/m.test(text)
  )
}
