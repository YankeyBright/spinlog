import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildTransactionalOutput, promoteStagedOutput } from '../scripts/build-output.mjs'

function writeMarker(directory: string, marker: string) {
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'marker.txt'), marker)
}

function temporaryProject() {
  return mkdtempSync(join(tmpdir(), 'spinlog-build-output-'))
}

function temporaryBuildEntries(projectRoot: string) {
  return readdirSync(projectRoot).filter((entry) => entry.startsWith('.dist.'))
}

describe('transactional build output', () => {
  it('promotes a complete staging directory and removes temporary artifacts', async () => {
    const projectRoot = temporaryProject()
    const outputDirectory = join(projectRoot, 'dist')
    writeMarker(outputDirectory, 'previous')

    try {
      await buildTransactionalOutput({
        projectRoot,
        outputDirectory,
        async build(stagingDirectory: string) {
          writeMarker(stagingDirectory, 'replacement')
        },
      })

      expect(readFileSync(join(outputDirectory, 'marker.txt'), 'utf8')).toBe('replacement')
      expect(temporaryBuildEntries(projectRoot)).toEqual([])
    } finally {
      rmSync(projectRoot, { force: true, recursive: true })
    }
  })

  it('preserves the previous distribution when staging the build fails', async () => {
    const projectRoot = temporaryProject()
    const outputDirectory = join(projectRoot, 'dist')
    writeMarker(outputDirectory, 'previous')

    try {
      await expect(
        buildTransactionalOutput({
          projectRoot,
          outputDirectory,
          async build(stagingDirectory: string) {
            writeMarker(stagingDirectory, 'partial')
            throw new Error('esbuild failed')
          },
        }),
      ).rejects.toThrow('esbuild failed')

      expect(readFileSync(join(outputDirectory, 'marker.txt'), 'utf8')).toBe('previous')
      expect(temporaryBuildEntries(projectRoot)).toEqual([])
    } finally {
      rmSync(projectRoot, { force: true, recursive: true })
    }
  })

  it('restores the previous distribution when promotion cannot rename the staged output', () => {
    const projectRoot = temporaryProject()
    const outputDirectory = join(projectRoot, 'dist')
    const missingStagingDirectory = join(projectRoot, 'missing')
    writeMarker(outputDirectory, 'previous')

    try {
      expect(() => promoteStagedOutput(missingStagingDirectory, outputDirectory)).toThrow()

      expect(existsSync(outputDirectory)).toBe(true)
      expect(readFileSync(join(outputDirectory, 'marker.txt'), 'utf8')).toBe('previous')
      expect(temporaryBuildEntries(projectRoot)).toEqual([])
    } finally {
      rmSync(projectRoot, { force: true, recursive: true })
    }
  })
})
