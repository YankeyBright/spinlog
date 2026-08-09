import { readFileSync } from 'node:fs'

const bom = JSON.parse(readFileSync('sbom.json', 'utf8'))
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const components = bom.components ?? []
const isReproducible = bom.metadata?.properties?.some(
  ({ name, value }) => name === 'cdx:reproducible' && value === 'true',
)

const failures = [
  bom.bomFormat === 'CycloneDX' ? '' : 'bomFormat must be CycloneDX',
  bom.specVersion === '1.5' ? '' : 'specVersion must be 1.5',
  bom.metadata?.component?.name === 'spinlog' ? '' : 'metadata.component.name must be spinlog',
  bom.metadata?.component?.type === 'library' ? '' : 'metadata.component.type must be library',
  bom.metadata?.component?.version === packageJson.version
    ? ''
    : 'metadata.component.version must match package.json',
  isReproducible ? '' : 'SBOM must be reproducible',
  components.length === 0 ? '' : `components must be empty, found ${components.length}`,
].filter(Boolean)

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure)
  }
  process.exit(1)
}

console.log('sbom=valid')
