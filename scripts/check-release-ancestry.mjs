import { runGit } from './git-executable.mjs'

const expectedRepository = 'YankeyBright/spinlog'
const expectedTag = 'v0.2.0'

function git(arguments_) {
  return runGit(arguments_, { encoding: 'utf8', windowsHide: true }).trim()
}

try {
  if (process.env.GITHUB_ACTIONS !== 'true')
    throw new Error('release ancestry requires GitHub Actions')
  if (process.env.GITHUB_REPOSITORY !== expectedRepository) {
    throw new Error(`release ancestry requires ${expectedRepository}`)
  }
  if (git(['describe', '--exact-match', '--tags', 'HEAD']) !== expectedTag) {
    throw new Error(`release ancestry requires the ${expectedTag} tag on HEAD`)
  }
  if (git(['rev-parse', 'HEAD']) !== git(['rev-parse', 'origin/main'])) {
    throw new Error('release tag must point to the reviewed origin/main commit')
  }
  if (git(['remote', 'get-url', 'origin']) !== 'https://github.com/YankeyBright/spinlog.git') {
    throw new Error('release ancestry requires the canonical HTTPS repository remote')
  }
  console.log('release-ancestry=valid')
} catch (error) {
  console.error(`release-ancestry: ${error.message}`)
  process.exitCode = 1
}
