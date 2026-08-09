import { isDeepStrictEqual } from 'node:util'

const REPRODUCIBLE_PROPERTY = Object.freeze({
  name: 'cdx:reproducible',
  value: 'true',
})

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    )
  }

  return value
}

export function normalizeSbom(input, packageJson) {
  const bom = structuredClone(input)
  const rootRef = `${packageJson.name}@${packageJson.version}`

  delete bom.serialNumber
  delete bom.metadata?.timestamp

  if (bom.metadata && typeof bom.metadata === 'object') {
    bom.metadata.tools = [{ vendor: 'npm', name: 'cli' }]
    const properties = Array.isArray(bom.metadata.properties)
      ? bom.metadata.properties.filter(({ name }) => name !== REPRODUCIBLE_PROPERTY.name)
      : []
    bom.metadata.properties = [...properties, REPRODUCIBLE_PROPERTY].sort(
      ({ name: left }, { name: right }) => left.localeCompare(right),
    )

    if (bom.metadata.component && typeof bom.metadata.component === 'object') {
      bom.metadata.component['bom-ref'] = rootRef
      bom.metadata.component.name = packageJson.name
      bom.metadata.component.purl = `pkg:npm/${packageJson.name}@${packageJson.version}`
      bom.metadata.component.type = 'library'
      bom.metadata.component.version = packageJson.version
    }
  }

  if (Array.isArray(bom.dependencies)) {
    const root = bom.dependencies.find(({ ref }) => ref === rootRef) ?? bom.dependencies[0]
    bom.dependencies = root ? [{ ref: rootRef, dependsOn: root.dependsOn ?? [] }] : []
  }

  return canonicalize(bom)
}

export function validateSbom(bom, packageJson) {
  const failures = []
  const expectedRef = `${packageJson.name}@${packageJson.version}`
  const components = bom.components
  const dependencies = bom.dependencies
  const metadataProperties = bom.metadata?.properties
  const externalReferences = bom.metadata?.component?.externalReferences

  if (bom.$schema !== 'http://cyclonedx.org/schema/bom-1.5.schema.json') {
    failures.push('$schema must identify CycloneDX 1.5')
  }
  if (bom.bomFormat !== 'CycloneDX') {
    failures.push('bomFormat must be CycloneDX')
  }
  if (bom.specVersion !== '1.5') {
    failures.push('specVersion must be 1.5')
  }
  if (bom.version !== 1) {
    failures.push('SBOM document version must be 1')
  }
  if ('serialNumber' in bom || 'timestamp' in (bom.metadata ?? {})) {
    failures.push('SBOM must not contain volatile serial or timestamp fields')
  }
  if (!isDeepStrictEqual(bom.metadata?.tools, [{ name: 'cli', vendor: 'npm' }])) {
    failures.push('SBOM generator identity must be the npm CLI without a volatile version')
  }
  if (
    !Array.isArray(metadataProperties) ||
    !metadataProperties.some(
      ({ name, value }) =>
        name === REPRODUCIBLE_PROPERTY.name && value === REPRODUCIBLE_PROPERTY.value,
    )
  ) {
    failures.push('SBOM must declare reproducible output')
  }
  if (bom.metadata?.component?.name !== packageJson.name) {
    failures.push('metadata.component.name must match package.json')
  }
  if (bom.metadata?.component?.version !== packageJson.version) {
    failures.push('metadata.component.version must match package.json')
  }
  if (bom.metadata?.component?.type !== 'library') {
    failures.push('metadata.component.type must be library')
  }
  if (bom.metadata?.component?.['bom-ref'] !== expectedRef) {
    failures.push('metadata.component bom-ref must match the package identity')
  }
  if (bom.metadata?.component?.purl !== `pkg:npm/${packageJson.name}@${packageJson.version}`) {
    failures.push('metadata.component purl must match the package identity')
  }
  if (
    !Array.isArray(externalReferences) ||
    !externalReferences.some(
      ({ type, url }) => type === 'vcs' && url === packageJson.repository?.url,
    )
  ) {
    failures.push('SBOM VCS reference must match package.json')
  }
  if (!Array.isArray(components) || components.length !== 0) {
    failures.push(`components must be empty, found ${components?.length ?? 'invalid'}`)
  }
  if (!isDeepStrictEqual(dependencies, [{ dependsOn: [], ref: expectedRef }])) {
    failures.push('dependency graph must contain only the dependency-free root package')
  }

  for (const dependencyType of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    if (Object.keys(packageJson[dependencyType] ?? {}).length !== 0) {
      failures.push(`${dependencyType} must be empty before generating the runtime SBOM`)
    }
  }

  return failures
}

export { REPRODUCIBLE_PROPERTY }
