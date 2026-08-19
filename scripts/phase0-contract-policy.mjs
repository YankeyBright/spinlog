import { isDeepStrictEqual } from 'node:util'

import { sortCanonicalText } from './canonical-order.mjs'

const STYLE_EXPORTS = Object.freeze([
  'reset',
  'bold',
  'dim',
  'italic',
  'underline',
  'strikethrough',
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'blackBright',
  'redBright',
  'greenBright',
  'yellowBright',
  'blueBright',
  'magentaBright',
  'cyanBright',
  'whiteBright',
  'bgBlack',
  'bgRed',
  'bgGreen',
  'bgYellow',
  'bgBlue',
  'bgMagenta',
  'bgCyan',
  'bgWhite',
  'bgBlackBright',
  'bgRedBright',
  'bgGreenBright',
  'bgYellowBright',
  'bgBlueBright',
  'bgMagentaBright',
  'bgCyanBright',
  'bgWhiteBright',
])

const TYPE_EXPORTS = Object.freeze([
  'PromiseOptions',
  'Spinlog',
  'Spinner',
  'SpinnerColor',
  'SpinnerName',
  'SpinnerOptions',
])

const SPINNER_COLORS = Object.freeze([
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'blackBright',
  'redBright',
  'greenBright',
  'yellowBright',
  'blueBright',
  'magentaBright',
  'cyanBright',
  'whiteBright',
])

const STATES = Object.freeze([
  'idle',
  'spinning',
  'stopped',
  'succeeded',
  'failed',
  'warned',
  'informed',
])

const TERMINAL_ACTIONS = Object.freeze({
  succeed: 'succeeded',
  fail: 'failed',
  warn: 'warned',
  info: 'informed',
})

const EXPECTED_RENDERING = Object.freeze({
  stream: 'stderr',
  stdoutWrites: false,
  segmentOrder: ['prefix', 'symbol', 'text', 'suffix'],
  segmentSeparator: ' ',
  dotsFrames: [
    '\u280b',
    '\u2819',
    '\u2839',
    '\u2838',
    '\u283c',
    '\u2834',
    '\u2826',
    '\u2827',
    '\u2807',
    '\u280f',
  ],
  lineFrames: ['-', '\\', '|', '/'],
  unicodeStatusSymbols: {
    succeed: '\u2714',
    fail: '\u2716',
    warn: '\u26a0',
    info: '\u2139',
  },
  asciiStatusSymbols: { succeed: '+', fail: 'x', warn: '!', info: 'i' },
  statusColors: { succeed: 'green', fail: 'red', warn: 'yellow', info: 'blue' },
  frameColorApplication: 'frame-only',
  statusColorApplication: 'symbol-only',
  emptySegments: 'omit',
  timerReferenced: false,
  interactive: {
    startSequence: ['hide-cursor', 'render-frame'],
    frameSequence: ['clear-line', 'render-frame'],
    stopSequence: ['clear-line', 'show-cursor'],
    terminalSequence: ['clear-line', 'render-status', 'newline', 'show-cursor'],
    firstFrame: 'synchronous',
    hideCursor: '\u001b[?25l',
    showCursor: '\u001b[?25h',
    clearLine: '\u001b[2K\r',
  },
  nonInteractive: {
    createTimer: false,
    cursorControl: false,
    startSequence: ['render-frame', 'newline'],
    stopSequence: [],
    terminalSequence: ['render-status', 'newline'],
  },
  flowMessages: {
    stream: 'stderr',
    writesPerCall: 1,
    lineEnding: '\n',
    separator: '  ',
    markerColor: 'blackBright',
    messageColor: 'none',
    emptyMessage: 'marker-only',
    unicodeSymbols: { intro: '┌', outro: '└' },
    asciiSymbols: { intro: '>', outro: '<' },
    stateless: true,
    paired: false,
    touchesSpinnerState: false,
    createsTimer: false,
    synchronousWriteFailure: 'suppress',
    backpressure: 'ignore',
    asynchronousErrors: 'host-owned',
  },
})

const EXPECTED_TEXT_SAFETY = Object.freeze({
  fields: ['text', 'prefix', 'suffix', 'terminalText', 'flowMessage'],
  boundary: 'render-only',
  preserveAssignedValues: true,
  stripVTControlCharacters: true,
  replaceCodePointRanges: [
    'U+0000-U+001F',
    'U+007F-U+009F',
    'U+061C',
    'U+200E-U+200F',
    'U+2028-U+202E',
    'U+2066-U+2069',
  ],
  replacement: ' ',
  trimSegmentBoundaries: true,
  embeddedAnsi: 'strip',
})

const EXPECTED_ENVIRONMENT = Object.freeze({
  colorPrecedenceDirection: 'highest-to-lowest',
  colorPrecedence: [
    'NO_COLOR',
    'NODE_DISABLE_COLORS',
    'FORCE_COLOR',
    'CI',
    'TERM=dumb',
    'NODE_ENV=test',
    'stderr.isTTY',
  ],
  noColor: 'non-empty-disables',
  noColorOverridesForceColor: true,
  nodeDisableColors: 'non-empty-disables',
  nodeDisableColorsOverridesForceColor: true,
  forceColorFalseValues: ['0', 'false'],
  forceColorOtherDefinedValues: 'enable',
  forceColorEnablesAnimation: false,
  ci: 'non-empty-disables',
  termDumb: 'exact-disables',
  nodeEnvTest: 'exact-disables',
  unicodeWindowsHeuristic: 'WT_SESSION-required',
})

const EXPECTED_INPUT_VALIDATION = Object.freeze({
  factoryText: 'string',
  options: 'non-null-non-array-object',
  textFields: ['text', 'prefix', 'suffix', 'terminalText', 'flowMessage'],
  spinnerNames: ['dots', 'line'],
  colors: 'publicApi.SpinnerColor',
  mutableFields: ['text', 'color', 'prefix', 'suffix'],
  unknownOptionKeys: 'ignore',
  invalidFactoryInput: 'throw-TypeError-before-output',
  invalidMutation: 'throw-TypeError-and-preserve-value',
  invalidTerminalOverride: 'throw-TypeError-before-idempotency-state-mutation-timer-or-output',
  invalidFlowMessage: 'throw-TypeError-before-capability-or-output',
  invalidPromiseOptions: 'reject-TypeError-before-start-or-input',
  invalidStyleInput: 'throw-TypeError-before-capability-detection',
})

const EXPECTED_PROMISE = Object.freeze({
  inputs: ['PromiseLike<T>', '() => PromiseLike<T>'],
  callbackArguments: 0,
  startBeforeInputObservation: true,
  return: 'Promise<T>',
  startBeforeCallback: true,
  invokeCallbackOnce: true,
  assimilateThenables: true,
  synchronousThrowBecomesRejection: true,
  fulfillmentAction: 'succeed',
  rejectionAction: 'fail',
  preserveFulfillmentValue: true,
  preserveRejectionReason: true,
  cosmeticFailureMasksSettlement: false,
})

const STYLE_CODES = Object.freeze({
  reset: [0, 0],
  bold: [1, 22],
  dim: [2, 22],
  italic: [3, 23],
  underline: [4, 24],
  strikethrough: [9, 29],
  black: [30, 39],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  magenta: [35, 39],
  cyan: [36, 39],
  white: [37, 39],
  blackBright: [90, 39],
  redBright: [91, 39],
  greenBright: [92, 39],
  yellowBright: [93, 39],
  blueBright: [94, 39],
  magentaBright: [95, 39],
  cyanBright: [96, 39],
  whiteBright: [97, 39],
  bgBlack: [40, 49],
  bgRed: [41, 49],
  bgGreen: [42, 49],
  bgYellow: [43, 49],
  bgBlue: [44, 49],
  bgMagenta: [45, 49],
  bgCyan: [46, 49],
  bgWhite: [47, 49],
  bgBlackBright: [100, 49],
  bgRedBright: [101, 49],
  bgGreenBright: [102, 49],
  bgYellowBright: [103, 49],
  bgBlueBright: [104, 49],
  bgMagentaBright: [105, 49],
  bgCyanBright: [106, 49],
  bgWhiteBright: [107, 49],
})

const EXPECTED_DEFERRED = Object.freeze([
  {
    id: 'task-groups',
    api: 'spinlog.group()',
    reason: 'Concurrent task orchestration requires a separate state and rendering contract.',
  },
  {
    id: 'progress-bars',
    api: 'spinlog.progress()',
    reason: 'Determinate progress needs independent update, throttling, and non-TTY semantics.',
  },
  {
    id: 'prompts',
    api: 'spinlog.confirm() and spinlog.text()',
    reason:
      'Raw input, cancellation, and cross-platform terminal behavior form a separate security boundary.',
  },
  {
    id: 'structured-logs',
    api: 'structured: true',
    reason: 'Machine output requires a separately versioned stdout schema.',
  },
  {
    id: 'custom-spinners',
    api: 'custom frames and intervals',
    reason: 'Arbitrary animation data expands validation, timing, and size requirements.',
  },
  {
    id: 'custom-streams',
    api: 'custom writable streams',
    reason:
      'The v1 stderr-only contract intentionally avoids stream ownership and error-listener complexity.',
  },
  {
    id: 'concurrent-spinners',
    api: 'multiple active spinners',
    reason: 'Shared-line coordination belongs with the deferred task-group renderer.',
  },
  {
    id: 'advanced-colors',
    api: 'style chaining, 256-color, and truecolor',
    reason:
      'The exact ANSI-16 named-export surface preserves tree-shaking and the fixed size budget.',
  },
])

const DOCUMENT_PATHS = Object.freeze([
  'README.md',
  'SECURITY.md',
  'specs/00_PHASE_MAP.md',
  'specs/01_PROJECT_MANIFEST.md',
  'specs/02_PROBLEM_STATEMENT.md',
  'specs/04_TECH_STACK.md',
  'specs/05_TERMINAL_SPEC.md',
  'specs/06_CORE_API_SPEC.md',
  'specs/07_ARCHITECTURE.md',
  'specs/08_SECURITY_COMPLIANCE.md',
  'specs/09_PHASE_0_PRODUCT_SPEC_LOCK.md',
  'specs/10_PHASE_1_PACKAGE_SCAFFOLDING.md',
  'specs/11_PHASE_2_CORE_IMPLEMENTATION_AND_TESTING.md',
  'specs/12_PHASE_3_BENCHMARK_SBOM.md',
  'specs/13_PHASE_4_DOCS_MIGRATION.md',
  'specs/15_RISKS.md',
  'specs/16_POST_MVP_FEATURES.md',
])

function sorted(value) {
  return sortCanonicalText(value)
}

function sameValues(actual, expected) {
  return JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected))
}

function require(condition, message, failures) {
  if (!condition) {
    failures.push(message)
  }
}

function requireExact(actual, expected, path, failures) {
  require(isDeepStrictEqual(actual, expected), `${path} must match the frozen contract`, failures)
}

function exactKeys(value, expected, path, failures) {
  require(value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value), `${path} must be an object`, failures)

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return
  }

  require(sameValues(
    Object.keys(value),
    expected,
  ), `${path} keys must be exactly: ${expected.join(', ')}`, failures)
}

export function renderPublicApiDeclaration(contract) {
  const colorUnion = SPINNER_COLORS.map((color) => `  | '${color}'`).join('\n')
  const styleSignature = '(text: string) => string'
  const styleDeclarations = contract.publicApi.styleExports
    .map((name) => `export declare const ${name}: ${styleSignature}`)
    .join('\n')

  return `/** Built-in spinner animation names. */
export type SpinnerName = 'dots' | 'line'

/** ANSI-16 foreground colors available to spinner frames. */
export type SpinnerColor =
${colorUnion}

/** Options used to create a spinner. */
export interface SpinnerOptions {
  color?: SpinnerColor
  prefix?: string
  suffix?: string
  spinner?: SpinnerName
}

/** Options used by the \`Spinlog.promise\` overloads. */
export interface PromiseOptions extends SpinnerOptions {
  text?: string
}

/** A mutable spinner with idempotent lifecycle methods. */
export interface Spinner {
  text: string
  color: SpinnerColor
  prefix: string
  suffix: string
  /** Starts a new rendering cycle or returns the active instance unchanged. */
  start(): this
  /** Stops an active cycle and restores owned terminal state. */
  stop(): this
  /** Persists the first successful terminal result for the current cycle. */
  succeed(text?: string): this
  /** Persists the first failed terminal result for the current cycle. */
  fail(text?: string): this
  /** Persists the first warning terminal result for the current cycle. */
  warn(text?: string): this
  /** Persists the first informational terminal result for the current cycle. */
  info(text?: string): this
}

/** Callable spinner factory with promise-settlement integration. */
export interface Spinlog {
  (text?: string, options?: SpinnerOptions): Spinner
  promise<T>(input: PromiseLike<T>, options?: PromiseOptions): Promise<T>
  promise<T>(task: () => PromiseLike<T>, options?: PromiseOptions): Promise<T>
  intro(message?: string): void
  outro(message?: string): void
}

${styleDeclarations.replace(`export declare const black: ${styleSignature}`, `\nexport declare const black: ${styleSignature}`).replace(`export declare const bgBlack: ${styleSignature}`, `\nexport declare const bgBlack: ${styleSignature}`)}

declare const spinlog: Spinlog

export default spinlog
`
}

export function renderStylesApiDeclaration(contract) {
  const styleDeclarations = contract.publicApi.styleExports
    .map((name) => `export declare const ${name}: Style`)
    .join('\n')

  return `/** A side-effect-free style transformation that follows stderr color capability. */
export type Style = (text: string) => string

${styleDeclarations.replace('export declare const black: Style', '\nexport declare const black: Style').replace('export declare const bgBlack: Style', '\nexport declare const bgBlack: Style')}
`
}

function validateDeclaration(declaration, stylesDeclaration, contract, failures) {
  require(declaration ===
    renderPublicApiDeclaration(
      contract,
    ), 'public API declaration must match the generated closed contract', failures)
  require(stylesDeclaration ===
    renderStylesApiDeclaration(
      contract,
    ), 'styles API declaration must match the generated closed contract', failures)
}

function expectedStartTransition(state) {
  if (state === 'spinning') {
    return { to: 'spinning', effect: 'none', idempotent: true }
  }
  return { to: 'spinning', effect: 'begin-cycle', idempotent: false }
}

function expectedStopTransition(state) {
  if (state === 'spinning') {
    return { to: 'stopped', effect: 'clear-and-restore', idempotent: false }
  }
  if (state === 'idle') {
    return { to: 'stopped', effect: 'none', idempotent: false }
  }
  if (state === 'stopped') {
    return { to: 'stopped', effect: 'none', idempotent: true }
  }
  return { to: state, effect: 'none', idempotent: true }
}

function expectedTerminalTransition(state, target) {
  if (STATES.slice(3).includes(state)) {
    return { to: state, effect: 'none', idempotent: true }
  }
  return {
    to: target,
    effect: state === 'spinning' ? 'stop-and-persist-status' : 'persist-status',
    idempotent: false,
  }
}

function validateActionLegalStates(stateMachine, failures) {
  for (const action of ['start', 'stop', ...Object.keys(TERMINAL_ACTIONS)]) {
    require(sameValues(
      Object.keys(stateMachine?.[action] ?? {}),
      STATES,
    ), `${action} must define every legal source state`, failures)
  }
}

function validateStateTransitions(stateMachine, failures) {
  for (const state of STATES) {
    const start = stateMachine?.start?.[state]
    const stop = stateMachine?.stop?.[state]
    exactKeys(start, ['to', 'effect', 'idempotent'], `stateMachine.start.${state}`, failures)
    exactKeys(stop, ['to', 'effect', 'idempotent'], `stateMachine.stop.${state}`, failures)
    requireExact(start, expectedStartTransition(state), `stateMachine.start.${state}`, failures)
    requireExact(stop, expectedStopTransition(state), `stateMachine.stop.${state}`, failures)

    for (const [action, target] of Object.entries(TERMINAL_ACTIONS)) {
      const transition = stateMachine?.[action]?.[state]
      exactKeys(
        transition,
        ['to', 'effect', 'idempotent'],
        `stateMachine.${action}.${state}`,
        failures,
      )
      requireExact(
        transition,
        expectedTerminalTransition(state, target),
        `stateMachine.${action}.${state}`,
        failures,
      )
    }
  }
}

function validateTransitions(contract, failures) {
  const stateMachine = contract.stateMachine
  require(stateMachine?.initial === 'idle', 'initial state must be idle', failures)
  requireExact(stateMachine?.states, STATES, 'stateMachine.states', failures)
  exactKeys(
    stateMachine,
    [
      'initial',
      'states',
      'start',
      'stop',
      ...Object.keys(TERMINAL_ACTIONS),
      'mutationsChangeState',
      'mutationsApply',
      'terminalTextOverridesStoredText',
    ],
    'stateMachine',
    failures,
  )

  validateActionLegalStates(stateMachine, failures)
  validateStateTransitions(stateMachine, failures)

  require(stateMachine?.mutationsChangeState ===
    false, 'mutations must not change lifecycle state', failures)
  require(stateMachine?.mutationsApply ===
    'next-render', 'mutations must apply on the next render', failures)
  require(stateMachine?.terminalTextOverridesStoredText ===
    true, 'terminal text must replace stored text before rendering', failures)
}

function validateDocuments(documents, contract, failures) {
  for (const path of DOCUMENT_PATHS) {
    require(typeof documents?.[path] === 'string', `missing Phase 0 document: ${path}`, failures)
  }

  const corpus = Object.values(documents ?? {}).join('\n')
  for (const [pattern, description] of [
    [/Node\s*(?:>=\s*)?18|Node18/g, 'legacy Node 18 policy'],
    [/github\.com\/spinlog\/spinlog/gi, 'placeholder repository identity'],
    [/process\.(?:on|once)\(['"]SIG(?:INT|TERM)/g, 'library-owned signal listener'],
    [/process\.exit\(/g, 'library-owned forced exit'],
    [/fs\.writeSync\(2/g, 'signal-context synchronous write'],
    [/\^22\.0\.0 \|\| \^24\.0\.0/g, 'obsolete Node engine floor'],
    [/\b(?:1,228|2,048)[- ]byte/g, 'obsolete size budget'],
    [/\bpure style helpers?\b/gi, 'incorrect pure-style claim'],
  ]) {
    require(!pattern.test(corpus), `normative documents contain ${description}`, failures)
  }

  for (const path of ['specs/09_PHASE_0_PRODUCT_SPEC_LOCK.md', 'specs/06_CORE_API_SPEC.md']) {
    require(documents?.[path]?.includes('specs/v1-public-api.d.ts') &&
      documents?.[path]?.includes('specs/v1-styles-api.d.ts') &&
      documents?.[path]?.includes(
        'specs/v1-behavior.json',
      ), `${path} must identify all machine-readable contracts as normative`, failures)
  }

  for (const [path, snippets] of Object.entries({
    'README.md': [
      '^22.13.0 || ^24.0.0 || ^26.0.0',
      'spinlog/styles',
      'https://github.com/YankeyBright/spinlog',
    ],
    'specs/00_PHASE_MAP.md': ['| 0 | Product and Spec Lock |', '| 5 | Trusted Release |'],
    'specs/01_PROJECT_MANIFEST.md': [
      'specs/v1-public-api.d.ts',
      'specs/v1-styles-api.d.ts',
      'specs/v1-behavior.json',
      '`^22.13.0 || ^24.0.0 || ^26.0.0`',
    ],
    'specs/05_TERMINAL_SPEC.md': ['never writes to `stdout`', 'installs no process signal'],
    'specs/09_PHASE_0_PRODUCT_SPEC_LOCK.md': [
      'Node 22, Node 24, and Node 26',
      '2,560 bytes',
      'only to `stderr`',
    ],
  })) {
    for (const snippet of snippets) {
      require(documents?.[path]?.includes(
        snippet,
      ), `${path} must contain the frozen contract text: ${snippet}`, failures)
    }
  }

  const terminalSpec = documents?.['specs/05_TERMINAL_SPEC.md'] ?? ''
  require(terminalSpec.indexOf('NO_COLOR') <
    terminalSpec.indexOf(
      'FORCE_COLOR=0',
    ), 'terminal capability policy must give NO_COLOR explicit precedence', failures)

  for (const { api, reason } of contract.deferred) {
    require(documents?.['specs/16_POST_MVP_FEATURES.md']?.includes(
      `**${api}**: ${reason}`,
    ), `specs/16_POST_MVP_FEATURES.md must include the exact rationale for ${api}`, failures)
  }
}

export function validatePhase0Contract({
  contract,
  declaration,
  stylesDeclaration,
  packageJson,
  documents = {},
}) {
  const failures = []

  exactKeys(
    contract,
    [
      'schemaVersion',
      'phase',
      'identity',
      'runtime',
      'size',
      'publicApi',
      'defaults',
      'rendering',
      'textSafety',
      'environment',
      'inputValidation',
      'stateMachine',
      'promise',
      'styles',
      'processOwnership',
      'writeFailures',
      'deferred',
      'permanentNonGoals',
    ],
    'contract',
    failures,
  )
  require(contract.schemaVersion === 6 &&
    contract.phase === 0, 'contract version and phase must be 6 and 0', failures)
  requireExact(
    contract.identity,
    {
      packageName: 'spinlog',
      author: 'spinlog contributors',
      license: 'MIT',
      repository: 'https://github.com/YankeyBright/spinlog',
      repositoryGit: 'git+https://github.com/YankeyBright/spinlog.git',
      visibility: 'public',
    },
    'identity',
    failures,
  )
  requireExact(
    contract.runtime,
    {
      engines: '^22.13.0 || ^24.0.0 || ^26.0.0',
      supportedMajors: [22, 24, 26],
      moduleFormat: 'esm',
      browserSupport: false,
    },
    'runtime',
    failures,
  )
  requireExact(
    contract.size,
    {
      artifact: 'dist/index.js',
      compression: 'gzip',
      level: 9,
      maximumBytes: 2560,
      singleStyleMaximumBytes: 600,
    },
    'size',
    failures,
  )
  requireExact(
    contract.publicApi,
    {
      declaration: 'specs/v1-public-api.d.ts',
      stylesDeclaration: 'specs/v1-styles-api.d.ts',
      stylesSubpath: 'spinlog/styles',
      defaultExport: 'spinlog',
      callableMethods: ['promise', 'intro', 'outro'],
      typeExports: TYPE_EXPORTS,
      styleExports: STYLE_EXPORTS,
    },
    'publicApi',
    failures,
  )
  requireExact(
    contract.defaults,
    { text: '', color: 'cyan', prefix: '', suffix: '', spinner: 'dots', intervalMs: 80 },
    'defaults',
    failures,
  )
  requireExact(contract.rendering, EXPECTED_RENDERING, 'rendering', failures)
  requireExact(contract.textSafety, EXPECTED_TEXT_SAFETY, 'textSafety', failures)
  requireExact(contract.environment, EXPECTED_ENVIRONMENT, 'environment', failures)
  requireExact(contract.inputValidation, EXPECTED_INPUT_VALIDATION, 'inputValidation', failures)
  requireExact(contract.promise, EXPECTED_PROMISE, 'promise', failures)
  requireExact(
    contract.styles,
    {
      input: 'string',
      output: 'string',
      sideEffectFree: true,
      readsCapability: true,
      writesStreams: false,
      nestedStylesRestoreParent: true,
      resetBehavior: 'hard-reset-boundary',
      resetRestoresParent: false,
      capabilityStream: 'stderr',
      escapePrefix: '\u001b[',
      escapeSuffix: 'm',
      sgr: STYLE_CODES,
    },
    'styles',
    failures,
  )
  requireExact(
    contract.processOwnership,
    {
      signalListeners: false,
      exitCalls: false,
      killCalls: false,
      globalStreamErrorListeners: false,
      applicationOwnsShutdown: true,
      explicitMethodsRestoreCursor: true,
    },
    'processOwnership',
    failures,
  )
  requireExact(
    contract.writeFailures,
    {
      catchSynchronousWrites: true,
      clearActiveTimer: true,
      attemptCursorRestore: true,
      activeFailureState: 'stopped',
      terminalStatePreserved: true,
      futureStartRetries: true,
      cleanupFailuresSuppressed: true,
      backpressureIsFailure: false,
      cosmeticMethodsThrow: false,
      promiseSettlementPreserved: true,
      asynchronousStreamErrorsOwnedByHost: true,
    },
    'writeFailures',
    failures,
  )
  requireExact(contract.deferred, EXPECTED_DEFERRED, 'deferred', failures)
  requireExact(
    contract.permanentNonGoals,
    ['commonjs', 'browser-first-runtime'],
    'permanentNonGoals',
    failures,
  )
  require(contract.identity?.repository ===
    'https://github.com/YankeyBright/spinlog', 'repository identity must match the public repository', failures)
  require(contract.identity?.visibility ===
    'public', 'repository visibility must be public', failures)
  require(contract.runtime?.engines ===
    '^22.13.0 || ^24.0.0 || ^26.0.0', 'runtime engines must require stable APIs on supported majors', failures)
  require(JSON.stringify(contract.runtime?.supportedMajors) ===
    JSON.stringify([22, 24, 26]), 'supported runtime majors must be Node 22, 24, and 26', failures)
  require(contract.runtime?.moduleFormat === 'esm' &&
    contract.runtime?.browserSupport === false, 'runtime must be ESM-only and Node-only', failures)
  require(contract.size?.artifact === 'dist/index.js' &&
    contract.size?.compression === 'gzip' &&
    contract.size?.level === 9 &&
    contract.size?.maximumBytes === 2560 &&
    contract.size?.singleStyleMaximumBytes ===
      600, 'size contract must enforce 2,560 root bytes and 600 single-style bytes using gzip level 9', failures)
  require(sameValues(
    contract.publicApi?.typeExports ?? [],
    TYPE_EXPORTS,
  ), 'contract type export list must match the declaration policy', failures)
  require(JSON.stringify(contract.publicApi?.styleExports) ===
    JSON.stringify(
      STYLE_EXPORTS,
    ), 'contract style exports must match the declaration policy', failures)
  require(isDeepStrictEqual(contract.defaults, {
    text: '',
    color: 'cyan',
    prefix: '',
    suffix: '',
    spinner: 'dots',
    intervalMs: 80,
  }), 'spinner defaults must match the frozen values', failures)
  require(contract.rendering?.stream === 'stderr' &&
    contract.rendering?.stdoutWrites === false, 'renderer must write only stderr', failures)
  require(contract.rendering?.timerReferenced === false &&
    contract.textSafety?.boundary === 'render-only' &&
    contract.textSafety?.preserveAssignedValues ===
      true, 'rendering must be unreferenced and sanitize without mutating public fields', failures)
  require(contract.styles?.sideEffectFree === true &&
    contract.styles?.readsCapability === true &&
    contract.styles?.writesStreams ===
      false, 'style helpers must be side-effect-free, capability-aware, and stream-free', failures)
  require(contract.processOwnership?.signalListeners === false &&
    contract.processOwnership?.exitCalls === false &&
    contract.processOwnership?.killCalls === false &&
    contract.processOwnership?.applicationOwnsShutdown ===
      true, 'the library must not own host shutdown', failures)
  require(contract.writeFailures?.cosmeticMethodsThrow === false &&
    contract.writeFailures?.promiseSettlementPreserved ===
      true, 'cosmetic failures must not throw or mask promise settlement', failures)
  require(contract.writeFailures?.activeFailureState === 'stopped' &&
    contract.writeFailures?.terminalStatePreserved === true &&
    contract.writeFailures?.futureStartRetries ===
      true, 'write failure must stop only the active cycle and preserve terminal state', failures)
  require(Array.isArray(contract.deferred) &&
    contract.deferred.length === 8 &&
    contract.deferred.every(
      ({ id, api, reason }) => id && api && reason,
    ), 'every deferred feature must have an id, API, and rationale', failures)

  require(packageJson?.name ===
    contract.identity?.packageName, 'package name must match the contract', failures)
  require(packageJson?.author ===
    contract.identity?.author, 'package author must match the contract', failures)
  require(packageJson?.license ===
    contract.identity?.license, 'package license must match the contract', failures)
  require(packageJson?.repository?.url ===
    contract.identity?.repositoryGit, 'package repository must match the contract', failures)
  require(packageJson?.engines?.node ===
    contract.runtime?.engines, 'package engines must match the contract', failures)
  require(packageJson?.type === 'module', 'package type must remain module', failures)
  for (const dependencyType of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    require(Object.keys(packageJson?.[dependencyType] ?? {}).length ===
      0, `${dependencyType} must remain empty`, failures)
  }

  validateDeclaration(declaration, stylesDeclaration, contract, failures)
  validateTransitions(contract, failures)
  validateDocuments(documents, contract, failures)

  return failures
}

export { DOCUMENT_PATHS, SPINNER_COLORS, STATES, STYLE_EXPORTS, TYPE_EXPORTS }
