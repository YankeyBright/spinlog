import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { DOCUMENT_PATHS, validatePhase0Contract } from '../scripts/phase0-contract-policy.mjs'

function loadFixture() {
  return {
    contract: JSON.parse(readFileSync('specs/v1-behavior.json', 'utf8')),
    declaration: readFileSync('specs/v1-public-api.d.ts', 'utf8'),
    stylesDeclaration: readFileSync('specs/v1-styles-api.d.ts', 'utf8'),
    packageJson: JSON.parse(readFileSync('package.json', 'utf8')),
    documents: Object.fromEntries(DOCUMENT_PATHS.map((path) => [path, readFileSync(path, 'utf8')])),
  }
}

describe('Phase 0 contract policy', () => {
  it('accepts the canonical API, behavior, identity, and documents', () => {
    expect(validatePhase0Contract(loadFixture())).toEqual([])
  })

  it('rejects a missing style export', () => {
    const fixture = loadFixture()
    fixture.declaration = fixture.declaration.replace(
      'export declare const bgWhiteBright: Style\n',
      '',
    )

    expect(validatePhase0Contract(fixture)).toContain(
      'public API declaration must match the generated closed contract',
    )
  })

  it('rejects styles subpath declaration drift', () => {
    const fixture = loadFixture()
    fixture.stylesDeclaration = fixture.stylesDeclaration.replace(
      'export declare const bgWhiteBright: Style\n',
      '',
    )

    expect(validatePhase0Contract(fixture)).toContain(
      'styles API declaration must match the generated closed contract',
    )
  })

  it('rejects changed promise overload semantics', () => {
    const fixture = loadFixture()
    fixture.declaration = fixture.declaration.replace(
      'promise<T>(task: () => PromiseLike<T>, options?: PromiseOptions): Promise<T>',
      'promise<T>(task: () => T, options?: PromiseOptions): T',
    )

    expect(validatePhase0Contract(fixture)).toContain(
      'public API declaration must match the generated closed contract',
    )
  })

  it('rejects an incomplete state transition table', () => {
    const fixture = loadFixture()
    delete fixture.contract.stateMachine.start.failed

    expect(validatePhase0Contract(fixture)).toContain('start must define every legal source state')
  })

  it('rejects non-idempotent terminal settlement', () => {
    const fixture = loadFixture()
    fixture.contract.stateMachine.fail.succeeded.idempotent = false

    expect(validatePhase0Contract(fixture)).toContain(
      'stateMachine.fail.succeeded must match the frozen contract',
    )
  })

  it('rejects a changed lifecycle destination or effect', () => {
    const fixture = loadFixture()
    fixture.contract.stateMachine.start.idle.to = 'failed'
    fixture.contract.stateMachine.stop.spinning.effect = 'none'

    expect(validatePhase0Contract(fixture)).toEqual(
      expect.arrayContaining([
        'stateMachine.start.idle must match the frozen contract',
        'stateMachine.stop.spinning must match the frozen contract',
      ]),
    )
  })

  it('rejects environment, rendering, and promise policy drift', () => {
    const fixture = loadFixture()
    fixture.contract.environment.colorPrecedence.reverse()
    fixture.contract.rendering.interactive.stopSequence = []
    fixture.contract.promise.rejectionAction = 'succeed'

    expect(validatePhase0Contract(fixture)).toEqual(
      expect.arrayContaining([
        'environment must match the frozen contract',
        'rendering must match the frozen contract',
        'promise must match the frozen contract',
      ]),
    )
  })

  it('rejects ANSI code, write-failure, and exact-size drift', () => {
    const fixture = loadFixture()
    fixture.contract.styles.sgr.red = [91, 39]
    fixture.contract.writeFailures.cosmeticMethodsThrow = true
    fixture.contract.size.maximumBytes = 2049

    expect(validatePhase0Contract(fixture)).toEqual(
      expect.arrayContaining([
        'styles must match the frozen contract',
        'writeFailures must match the frozen contract',
        'size must match the frozen contract',
      ]),
    )
  })

  it('rejects unsafe text rendering and referenced timer drift', () => {
    const fixture = loadFixture()
    fixture.contract.textSafety.stripVTControlCharacters = false
    fixture.contract.textSafety.boundary = 'assignment'
    fixture.contract.rendering.timerReferenced = true

    expect(validatePhase0Contract(fixture)).toEqual(
      expect.arrayContaining([
        'textSafety must match the frozen contract',
        'rendering must match the frozen contract',
        'rendering must be unreferenced and sanitize without mutating public fields',
      ]),
    )
  })

  it('rejects bidi sanitization and runtime validation drift', () => {
    const fixture = loadFixture()
    fixture.contract.textSafety.replaceCodePointRanges.pop()
    fixture.contract.inputValidation.invalidMutation = 'accept-invalid-value'

    expect(validatePhase0Contract(fixture)).toEqual(
      expect.arrayContaining([
        'textSafety must match the frozen contract',
        'inputValidation must match the frozen contract',
      ]),
    )
  })

  it('rejects ambiguous active and terminal write-failure behavior', () => {
    const fixture = loadFixture()
    fixture.contract.writeFailures.activeFailureState = 'spinning'
    fixture.contract.writeFailures.terminalStatePreserved = false
    fixture.contract.writeFailures.futureStartRetries = false

    expect(validatePhase0Contract(fixture)).toEqual(
      expect.arrayContaining([
        'writeFailures must match the frozen contract',
        'write failure must stop only the active cycle and preserve terminal state',
      ]),
    )
  })

  it('rejects frame, status, and reset semantic drift', () => {
    const fixture = loadFixture()
    fixture.contract.rendering.frameColorApplication = 'whole-line'
    fixture.contract.rendering.statusColorApplication = 'whole-line'
    fixture.contract.styles.resetRestoresParent = true

    expect(validatePhase0Contract(fixture)).toEqual(
      expect.arrayContaining([
        'rendering must match the frozen contract',
        'styles must match the frozen contract',
      ]),
    )
  })

  it('rejects ambiguous CI and terminal capability semantics', () => {
    const fixture = loadFixture()
    fixture.contract.environment.ci = 'truthy-disables'

    expect(validatePhase0Contract(fixture)).toContain('environment must match the frozen contract')
  })

  it('rejects ambiguous or FORCE_COLOR-first precedence semantics', () => {
    const fixture = loadFixture()
    fixture.contract.environment.colorPrecedenceDirection = 'lowest-to-highest'
    fixture.contract.environment.noColorOverridesForceColor = false
    fixture.contract.environment.nodeDisableColorsOverridesForceColor = false

    expect(validatePhase0Contract(fixture)).toContain('environment must match the frozen contract')
  })

  it('rejects library-owned signals and forced exits', () => {
    const fixture = loadFixture()
    fixture.contract.processOwnership.signalListeners = true
    fixture.contract.processOwnership.exitCalls = true

    expect(validatePhase0Contract(fixture)).toContain('the library must not own host shutdown')
  })

  it('rejects Node 18 and repository drift', () => {
    const fixture = loadFixture()
    fixture.packageJson.engines.node = '>=18'
    fixture.packageJson.repository.url = 'https://github.com/spinlog/spinlog.git'

    expect(validatePhase0Contract(fixture)).toEqual(
      expect.arrayContaining([
        'package repository must match the contract',
        'package engines must match the contract',
      ]),
    )
  })

  it('rejects a deferred feature without rationale', () => {
    const fixture = loadFixture()
    fixture.contract.deferred[0].reason = ''

    expect(validatePhase0Contract(fixture)).toContain(
      'every deferred feature must have an id, API, and rationale',
    )
  })

  it('rejects unsafe normative prose even when keywords remain present', () => {
    const fixture = loadFixture()
    fixture.documents['specs/05_TERMINAL_SPEC.md'] +=
      "\nprocess.on('SIGINT', () => process.exit(130))\n"

    expect(validatePhase0Contract(fixture)).toEqual(
      expect.arrayContaining([
        'normative documents contain library-owned signal listener',
        'normative documents contain library-owned forced exit',
      ]),
    )
  })
})
