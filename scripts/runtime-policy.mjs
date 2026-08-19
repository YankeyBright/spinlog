import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { parse } from '@babel/parser'

import { compareCanonicalText, sortCanonicalText } from './canonical-order.mjs'

export const APPROVED_RUNTIME_FILES = Object.freeze([
  'ansi.ts',
  'env.ts',
  'index.ts',
  'messages.ts',
  'spinner.ts',
  'styles.ts',
  'text.ts',
])

const APPROVED_IMPORTS = Object.freeze({
  'ansi.ts': ['node:util'],
  'env.ts': [],
  'index.ts': [],
  'messages.ts': [],
  'spinner.ts': [],
  'styles.ts': ['node:util'],
  'text.ts': ['node:process', 'node:util'],
})
const PROCESS_LISTENERS = new Set([
  'process.on',
  'process.once',
  'process.addListener',
  'process.prependListener',
])
const HOST_TERMINATION_CALLS = new Set(['process.exit', 'process.kill', 'process.abort'])
const STDERR_LISTENERS = new Set([
  'stderr.on',
  'stderr.once',
  'stderr.addListener',
  'stderr.prependListener',
  'process.stderr.on',
  'process.stderr.once',
  'process.stderr.addListener',
  'process.stderr.prependListener',
])
const STDOUT_WRITES = new Set(['stdout.write', 'process.stdout.write'])
const SIGNALS = new Set(['SIGINT', 'SIGTERM'])

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
  const program = parseRuntimeSource(path, text, failures)
  if (!program) return

  validateImports(path, program, failures)
  if (hasDynamicNodeBuiltinLoad(program)) {
    failures.push(`${path} must not dynamically load Node built-ins`)
  }
  if (hasUnapprovedProcessImport(program)) {
    failures.push(`${path} may import only stderr from node:process`)
  }
  validateRuntimeOperations(path, program, failures)
}

function parseRuntimeSource(path, text, failures) {
  try {
    return parse(text, { plugins: ['typescript'], sourceFilename: path, sourceType: 'module' })
      .program
  } catch {
    failures.push(`${path} must contain valid TypeScript`)
    return undefined
  }
}

function validateImports(path, program, failures) {
  const imports = [...staticNodeBuiltinSpecifiers(program)]
  const approved = APPROVED_IMPORTS[path] ?? []
  for (const specifier of imports) {
    if (!approved.includes(specifier)) {
      failures.push(`${path} imports unapproved built-in: ${specifier}`)
    }
  }
}

function* staticNodeBuiltinSpecifiers(program) {
  for (const statement of program.body) {
    if (
      statement.type === 'ImportDeclaration' ||
      statement.type === 'ExportAllDeclaration' ||
      statement.type === 'ExportNamedDeclaration'
    ) {
      const specifier = nodeBuiltinSpecifier(statement.source)
      if (specifier?.startsWith('node:')) yield specifier
      continue
    }

    if (
      statement.type === 'TSImportEqualsDeclaration' &&
      statement.moduleReference.type === 'TSExternalModuleReference'
    ) {
      const specifier = nodeBuiltinSpecifier(statement.moduleReference.expression)
      if (specifier?.startsWith('node:')) yield specifier
    }
  }
}

function hasDynamicNodeBuiltinLoad(program) {
  return sourceContains(program, (node) => {
    if (
      node.type === 'TSImportEqualsDeclaration' &&
      node.moduleReference.type === 'TSExternalModuleReference'
    ) {
      return nodeBuiltinSpecifier(node.moduleReference.expression)?.startsWith('node:') === true
    }
    if (node.type !== 'CallExpression' || node.arguments.length === 0) return false

    const specifier = nodeBuiltinSpecifier(node.arguments[0])
    return (
      specifier?.startsWith('node:') === true &&
      (node.callee.type === 'Import' ||
        (node.callee.type === 'Identifier' && node.callee.name === 'require'))
    )
  })
}

function hasUnapprovedProcessImport(program) {
  return sourceContains(
    program,
    (node) =>
      (node.type === 'ImportDeclaration' &&
        nodeBuiltinSpecifier(node.source) === 'node:process' &&
        !isApprovedProcessImport(node)) ||
      (node.type === 'TSImportEqualsDeclaration' &&
        node.moduleReference.type === 'TSExternalModuleReference' &&
        nodeBuiltinSpecifier(node.moduleReference.expression) === 'node:process'),
  )
}

function isApprovedProcessImport(declaration) {
  if (declaration.importKind === 'type' || declaration.specifiers.length !== 1) return false

  const [binding] = declaration.specifiers
  return (
    binding.type === 'ImportSpecifier' &&
    binding.importKind !== 'type' &&
    binding.imported.type === 'Identifier' &&
    binding.imported.name === 'stderr' &&
    binding.local.name === 'stderr'
  )
}

function validateRuntimeOperations(path, program, failures) {
  const operations = new Set()
  sourceContains(program, (node) => {
    if (node.type === 'StringLiteral' && SIGNALS.has(node.value)) operations.add('signal ownership')
    if (node.type !== 'CallExpression' && node.type !== 'OptionalCallExpression') return false

    const target = memberAccessPath(node.callee)
    if (PROCESS_LISTENERS.has(target)) operations.add('process listener')
    if (HOST_TERMINATION_CALLS.has(target)) operations.add('host termination call')
    if (STDERR_LISTENERS.has(target)) operations.add('stderr listener')
    if (STDOUT_WRITES.has(target)) operations.add('stdout write')
    return false
  })

  for (const operation of operations) failures.push(`${path} must not contain ${operation}`)
}

function sourceContains(program, predicate) {
  let found = false
  function visit(node) {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return
    if (predicate(node)) {
      found = true
      return
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'extra' || key === 'loc') continue
      if (Array.isArray(value)) {
        for (const child of value) visit(child)
      } else {
        visit(value)
      }
    }
  }
  visit(program)
  return found
}

function memberAccessPath(node) {
  if (node.type === 'Identifier') return node.name
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
    const receiver = memberAccessPath(node.object)
    const property = node.computed ? nodeBuiltinSpecifier(node.property) : node.property.name
    return receiver === undefined || property === undefined ? undefined : `${receiver}.${property}`
  }
  return undefined
}

function nodeBuiltinSpecifier(node) {
  return node?.type === 'StringLiteral' ? node.value : undefined
}
