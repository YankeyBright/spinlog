import { isDeepStrictEqual } from 'node:util'

import { sortCanonicalText } from './canonical-order.mjs'

export const APPROVED_PACKAGE_FILES = Object.freeze([
  'LICENSE',
  'README.md',
  'SECURITY.md',
  'dist/index.d.ts',
  'dist/index.js',
  'dist/index.js.map',
  'dist/styles.d.ts',
  'dist/styles.js',
  'dist/styles.js.map',
  'package.json',
  'sbom.json',
])

function reportsFrom(value) {
  if (Array.isArray(value)) return value
  if (value !== null && typeof value === 'object') {
    if (Array.isArray(value.files)) return [value]
    return Object.values(value)
  }
  return []
}

export function validatePackOutput(value) {
  const failures = []
  const reports = reportsFrom(value)

  if (reports.length !== 1) {
    return [`npm pack must return exactly one package result, found ${reports.length}`]
  }

  const [pack] = reports
  if (pack === null || typeof pack !== 'object' || !Array.isArray(pack.files)) {
    return ['npm pack result must contain a files array']
  }

  const paths = pack.files.map((file) => file?.path)
  if (paths.some((path) => typeof path !== 'string')) {
    failures.push('every packaged file must have a string path')
  }

  const validPaths = paths.filter((path) => typeof path === 'string')
  if (new Set(validPaths).size !== validPaths.length) {
    failures.push('packaged file paths must not contain duplicates')
  }

  if (
    !isDeepStrictEqual(sortCanonicalText(validPaths), sortCanonicalText(APPROVED_PACKAGE_FILES))
  ) {
    const unexpected = validPaths.filter((path) => !APPROVED_PACKAGE_FILES.includes(path))
    const missing = APPROVED_PACKAGE_FILES.filter((path) => !validPaths.includes(path))

    if (unexpected.length > 0) failures.push(`unexpected package files: ${unexpected.join(', ')}`)
    if (missing.length > 0) failures.push(`missing package files: ${missing.join(', ')}`)
    if (unexpected.length === 0 && missing.length === 0) {
      failures.push(
        `package files must match the approved ${APPROVED_PACKAGE_FILES.length} paths exactly`,
      )
    }
  }

  if (validPaths.length !== APPROVED_PACKAGE_FILES.length) {
    failures.push(
      `package must contain exactly ${APPROVED_PACKAGE_FILES.length} files, found ${validPaths.length}`,
    )
  }
  if (pack.entryCount !== APPROVED_PACKAGE_FILES.length) {
    failures.push(
      `tarball entryCount must be ${APPROVED_PACKAGE_FILES.length}, found ${String(pack.entryCount)}`,
    )
  }
  if (!Array.isArray(pack.bundled) || pack.bundled.length !== 0) {
    failures.push('tarball must contain zero bundled dependencies')
  }

  return failures
}
