import { isDeepStrictEqual } from 'node:util'

import { sortCanonicalText } from './canonical-order.mjs'
import {
  renderPublicApiDeclaration,
  renderStylesApiDeclaration,
} from './phase0-contract-declarations.mjs'

export { SPINNER_COLORS } from './phase0-contract-catalog.mjs'
export {
  renderPublicApiDeclaration,
  renderStylesApiDeclaration,
} from './phase0-contract-declarations.mjs'

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
  'FlowOptions',
  'FlushOptions',
  'GroupOptions',
  'PromiseOptions',
  'PromiseSettlementText',
  'Progress',
  'ProgressOptions',
  'RenderOptions',
  'Spinlog',
  'Spinner',
  'SpinnerColor',
  'SpinnerDefinition',
  'SpinnerGroup',
  'SpinnerName',
  'SpinnerOptions',
  'UnicodeMode',
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
  defaultStream: 'process.stderr',
  explicitWritableStreams: true,
  globalWritePatching: false,
  defaultStdoutWrites: false,
  stdinManagement: false,
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
  colorFalse: 'disable-automatic-surface-color',
  unicodeFalse: 'ascii-built-ins-only',
  hideCursorFalse: 'suppress-cursor-escapes',
  indentRange: [0, 40],
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
  staticModes: {
    default: 'symbol',
    options: ['symbol', 'text', 'silent'],
    appliesFor: [
      'non-interactive',
      'lease-unavailable',
      'terminal-static',
      'width-demotion',
      'height-demotion',
    ],
    symbol: {
      startSequence: ['render-frame', 'newline'],
      terminalSequence: ['render-status', 'newline'],
    },
    text: {
      startSequence: ['render-text', 'newline'],
      terminalSequence: ['render-text', 'newline'],
      color: 'none',
      status: 'none',
    },
    silent: {
      startSequence: [],
      terminalSequence: [],
      cursorRestoreAfterDemotion: true,
    },
  },
  log: {
    target: 'surface-target',
    states: 'all',
    return: 'same-instance',
    validation: 'string-before-output',
    sanitization: 'render-boundary',
    output: 'one-permanent-newline-terminated-line',
    activeFrameCoordination: 'clear-write-redraw-target-local',
    changesState: false,
    changesTimer: false,
    backpressure: 'permanent-ordered-cosmetic-coalesced',
    synchronousWriteFailure: 'suppress',
  },
  flowMessages: {
    target: 'explicit-writable-default-stderr',
    writesPerCall: 1,
    lineEnding: '\n',
    separator: '  ',
    markerColor: 'blackBright',
    messageColor: 'none',
    emptyMessage: 'marker-only',
    unicodeSymbols: { intro: '\u250c', outro: '\u2514' },
    asciiSymbols: { intro: '>', outro: '<' },
    stateless: true,
    paired: false,
    touchesSpinnerState: false,
    activeFrameCoordination: 'clear-write-redraw-target-local',
    createsTimer: false,
    synchronousWriteFailure: 'suppress',
    backpressure: 'permanent-ordered-cosmetic-coalesced',
    asynchronousErrors: 'host-owned-when-idle',
  },
  interactiveLease: {
    scope: 'writable-stream-identity',
    activeSurfaceLimit: 1,
    rootSpinnerLimit: 1,
    secondarySurface: 'static-on-same-target',
    independentTargets: 'independent',
    release: ['stop', 'terminal', 'dispose', 'write-failure', 'group-session-idle'],
  },
  widthSafety: {
    source: 'target.columns',
    minimumColumns: 3,
    measurement: 'grapheme-cluster-wcwidth',
    asciiCellWidth: 1,
    combiningMarkWidth: 0,
    wideCellWidth: 2,
    emojiClusterWidth: 2,
    maximumWidth: 'less-than-columns-minus-one',
    unavailable: 'static',
    overflow: 'static',
    resize: 'demote-to-static',
    mutation: 'demote-to-static',
  },
  heightSafety: {
    source: 'target.rows',
    groupsOnly: true,
    reserveRows: 1,
    unavailable: 'static',
    overflow: 'static',
    resize: 'demote-to-static',
    mutation: 'demote-to-static',
  },
  writeBackpressure: {
    results: ['written', 'backpressured', 'failed'],
    permanentLines: 'write-in-order',
    readyOversizedPermanentWrite: 'attempt-immediately',
    cosmeticFrames: 'coalesce-latest-until-drain',
    unboundedQueue: false,
    pendingLimits: { tasks: 64, bytes: 65536 },
    permanentWriteCompletion: 'node-write-callback-sequence-watermark',
    flushBoundary: 'accepted-permanent-sequence-watermark',
    targetError: 'pending-output-rejects-flush-stops-lease-clears-queue',
    targetErrorReplay: 'next-flush-rejects-once-then-retry',
    listenerEvents: ['drain', 'finish', 'close', 'error'],
    finishWithoutQueuedOutput: 'resolve-flush',
    finishWithQueuedOutput: 'reject-flush',
    closeBeforeDrain: 'reject-flush',
    listenerLifecycle: 'remove-on-quiescence-finish-close-error-or-failure',
    synchronousFailure: 'stop-affected-surface-and-restore-owned-cursor',
  },
  renderCache: {
    sanitization: 'lazy-render-boundary',
    fields: ['text', 'prefix', 'suffix'],
    colorMutation: 'reuse-text-snapshot',
    width: 'cached-grapheme-cells',
  },
  customFrames: {
    source: 'spinner-name-or-definition-time-sanitized-frozen-snapshot',
    maximumFrames: 64,
    intervalRangeMs: [16, 60000],
    sanitization: 'definition-time',
    frameValidation: 'string-and-visible-after-definition-sanitization',
    snapshot: 'immutable-sanitized',
    singleFrame: 'static-no-timer',
    customUnicodeFallback: 'caller-owned',
    timer: 'unreferenced',
  },
  groups: {
    target: 'explicit-writable-default-stderr',
    childCreation: 'idle',
    scheduler: 'one-unreferenced-target-surface-timer',
    interactiveSurface: 'one-target-local-lease',
    rows: 'single-line-sanitized-and-grapheme-width-and-height-checked',
    maxRows: 'positive-safe-integer-or-dynamic-default',
    defaultMaxRows: 'min(10, target.rows - 1)',
    contention: 'static-on-same-target',
    widthDemotion: 'atomic-static',
    heightDemotion: 'atomic-static',
    flowCoordination: 'clear-write-redraw-all-rows-target-local',
    persistedRows: 'never-redrawn-by-later-session',
    staticRestart: 'explicit-stop-and-restart-required',
    idleSession: 'release-when-no-active-surface-rows',
    nestedGroups: false,
    dynamicReordering: false,
    processOwnership: false,
  },
  progress: {
    target: 'explicit-writable-default-stderr',
    total: 'positive-safe-integer',
    totalProperty: 'immutable-runtime-getter',
    value: 'safe-integer-between-zero-and-total',
    defaultBarWidth: 20,
    barWidthRange: [5, 40],
    styleDefault: 'blocks',
    styles: ['blocks', 'ascii'],
    unicodeFallback: 'blocks-to-ascii',
    filledCells: 'floor',
    increment: 'positive-safe-integer',
    succeedValue: 'total',
    interactive: 'single-line-target-local-lease-no-timer',
    static: 'initial-and-terminal-only',
    updates: 'synchronous-coordinated-redraw',
    rateEtaFormatting: false,
  },
})

const EXPECTED_TEXT_SAFETY = Object.freeze({
  fields: ['text', 'prefix', 'suffix', 'terminalText', 'flowMessage', 'logMessage', 'progressText'],
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
  capabilityShape: ['sgr', 'cursor', 'color', 'emphasis', 'animation', 'unicode'],
  capabilityResolution: 'per-render-target',
  colorPrecedenceDirection: 'highest-to-lowest',
  colorPrecedence: [
    'NO_COLOR',
    'NODE_DISABLE_COLORS',
    'FORCE_COLOR',
    'CI',
    'TERM=dumb',
    'NODE_ENV=test',
    'target.isTTY',
    'known-terminal-profile',
  ],
  noColor: 'non-empty-disables-colors-only',
  noColorOverridesForceColor: true,
  nodeDisableColors: 'non-empty-disables-colors-only',
  nodeDisableColorsOverridesForceColor: true,
  forceColorFalseValues: ['0', 'false'],
  forceColorOtherDefinedValues: 'enable',
  forceColorEnablesAnimation: false,
  forceColorEnablesEmphasis: true,
  interactiveEmphasisWhenColorDisabled: true,
  nonInteractiveEmphasis: 'disabled',
  ci: 'non-empty-disables',
  termDumb: 'exact-disables',
  nodeEnvTest: 'exact-disables',
  unicodeWindowsHeuristic: 'WT_SESSION-required',
  cursorTerminalPrefixes: [
    'xterm',
    'screen',
    'tmux',
    'rxvt',
    'linux',
    'cygwin',
    'st',
    'alacritty',
    'kitty',
    'wezterm',
    'foot',
    'konsole',
    'vte',
    'eterm',
    'putty',
  ],
  terminalProfileMatch: 'ascii-lowercase-exact-or-dash-suffix',
  unknownTerminalProfile: 'auto-static-and-no-default-sgr',
  limitedTerminalProfiles: ['vt100', 'vt220'],
  terminalModes: ['auto', 'static', 'interactive'],
  staticTerminalMode: 'disables-animation',
  interactiveTerminalMode: 'tty-and-not-dumb-overrides-profile-ci-test-only',
})

const EXPECTED_INPUT_VALIDATION = Object.freeze({
  factoryText: 'string',
  options: 'non-null-non-array-object',
  stream: 'Node-Writable-with-write-function',
  textFields: [
    'text',
    'prefix',
    'suffix',
    'terminalText',
    'flowMessage',
    'logMessage',
    'customFrame',
    'progressText',
  ],
  spinnerNames: ['dots', 'line'],
  colors: 'publicApi.SpinnerColor',
  mutableFields: ['text', 'color', 'prefix', 'suffix'],
  unknownOptionKeys: 'ignore',
  invalidFactoryInput: 'throw-TypeError-before-output',
  invalidStream: 'throw-TypeError-before-capability-or-output',
  invalidMutation: 'throw-TypeError-and-preserve-value',
  invalidTerminalOverride: 'throw-TypeError-before-idempotency-state-mutation-timer-or-output',
  invalidFlowMessage: 'throw-TypeError-before-capability-or-output',
  staticModes: ['symbol', 'text', 'silent'],
  terminalModes: ['auto', 'static', 'interactive'],
  unicodeModes: ['auto', true, false],
  invalidUnicodeMode: 'throw-TypeError-before-output',
  invalidHideCursor: 'throw-TypeError-before-output',
  indent: 'safe-integer-zero-to-40',
  invalidIndent: 'throw-TypeError-before-output',
  customFrames: 'one-to-64-visible-strings-definition-time-sanitized-and-snapshotted-before-output',
  customInterval: 'safe-integer-16-to-60000-before-output',
  invalidGroupOptions: 'throw-TypeError-before-output',
  groupMaxRows: 'positive-safe-integer',
  invalidGroupMaxRows: 'throw-TypeError-before-output',
  invalidProgressTotal: 'throw-TypeError-before-output',
  invalidProgressValue: 'throw-TypeError-and-preserve-value',
  progressWidth: 'safe-integer-five-to-40',
  progressStyles: ['blocks', 'ascii'],
  invalidProgressWidth: 'throw-TypeError-before-output',
  invalidProgressStyle: 'throw-TypeError-before-output',
  incrementAmount: 'positive-safe-integer',
  invalidIncrementAmount: 'throw-TypeError-and-preserve-value',
  invalidStaticMode: 'throw-TypeError-before-output',
  invalidTerminalMode: 'throw-TypeError-before-output',
  invalidLogMessage: 'throw-TypeError-before-output',
  invalidPromiseOptions: 'reject-TypeError-before-start-or-input',
  promiseSettlementText: 'string-or-callback',
  invalidPromiseSettlementText: 'reject-TypeError-before-start-or-input',
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
  successText: 'string-or-fulfillment-callback',
  failText: 'string-or-rejection-callback',
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
    id: 'global-write-interception',
    api: 'patching console or arbitrary Writable.write()',
    reason:
      'Applications own non-Spinlog output; interception would make ordering, error ownership, and shutdown behavior implicit.',
  },
  {
    id: 'stdin-ownership',
    api: 'stdin raw-mode, prompts, or input cancellation',
    reason: 'Spinlog deliberately leaves stdin and process input policy under application control.',
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
    [/\bv1\.1\b/gi, 'obsolete pre-1.0 contract label'],
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
      'spinlog@0.2.0',
      'spinlog/styles',
      'One interactive surface is allowed per writable identity',
      'never patches `console`',
      'never manages stdin',
      'https://github.com/YankeyBright/spinlog',
    ],
    'specs/00_PHASE_MAP.md': ['| 0 | Product and Spec Lock |', '| 5 | Trusted Release |'],
    'specs/01_PROJECT_MANIFEST.md': [
      'specs/v1-public-api.d.ts',
      'specs/v1-styles-api.d.ts',
      'specs/v1-behavior.json',
      '`^22.13.0 || ^24.0.0 || ^26.0.0`',
    ],
    'specs/05_TERMINAL_SPEC.md': [
      'defaults to `process.stderr`',
      'explicit writable stream',
      'one interactive surface per writable stream',
      'never manages stdin',
      'installs no process signal',
      'SGR, cursor control, color, emphasis, animation, and Unicode are separate named capability decisions.',
      'explicit `reset`, `bold`, `dim`, `italic`, `underline`, and `strikethrough` remain available when color is disabled',
      'An immutable sanitized snapshot and grapheme-aware terminal-cell width are created lazily',
      'Temporary `drain`, `finish`, `close`, and `error` listeners',
    ],
    'specs/09_PHASE_0_PRODUCT_SPEC_LOCK.md': [
      'Node 22, Node 24, and Node 26',
      '10,240 bytes',
      'pre-1.0',
      'explicit writable streams',
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
  require(contract.schemaVersion === 14 &&
    contract.phase === 0, 'contract version and phase must be 14 and 0', failures)
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
      maximumBytes: 10240,
      singleStyleMaximumBytes: 768,
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
      callableMethods: ['promise', 'intro', 'outro', 'flush', 'group', 'progress'],
      spinnerMethods: [
        'start',
        'stop',
        'log',
        'flush',
        'Symbol.dispose',
        'succeed',
        'fail',
        'warn',
        'info',
      ],
      groupMethods: ['add', 'stop', 'flush', 'Symbol.dispose'],
      progressMethods: [
        'start',
        'stop',
        'log',
        'flush',
        'Symbol.dispose',
        'succeed',
        'fail',
        'warn',
        'info',
        'update',
        'increment',
      ],
      spinnerDisposal: 'Symbol.dispose',
      typeExports: TYPE_EXPORTS,
      styleExports: STYLE_EXPORTS,
    },
    'publicApi',
    failures,
  )
  requireExact(
    contract.defaults,
    {
      text: '',
      stream: 'process.stderr',
      color: 'cyan',
      unicode: 'auto',
      hideCursor: true,
      indent: 0,
      prefix: '',
      suffix: '',
      spinner: 'dots',
      static: 'symbol',
      terminal: 'auto',
      intervalMs: 80,
      groupMaxRows: 'min(10, target.rows - 1)',
      progressBarWidth: 20,
      progressStyle: 'blocks',
    },
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
      metadata: {
        singleSourceOfTruth: true,
        colorClassification: ['foreground', 'background'],
        emphasisClassification: ['reset', 'modifiers'],
        spinnerColorValidation: 'foreground-only',
        nestedRestore: 'metadata-driven',
      },
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
      temporaryBackpressureListeners: ['drain', 'finish', 'close', 'error'],
      applicationOwnsShutdown: true,
      explicitMethodsRestoreCursor: true,
      disposalRestoresCursor: true,
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
      backpressure: 'coalesce-cosmetic-frames-until-drain',
      permanentLinesPreserveOrder: true,
      unboundedWriteQueue: false,
      failureScope: 'affected-target-surface-only',
      cosmeticMethodsThrow: false,
      promiseSettlementPreserved: true,
      asynchronousStreamErrors: 'host-owned-when-no-spinlog-output-is-pending',
      pendingTargetError: 'SpinlogTargetError-with-original-cause',
      pendingTargetErrorEffect: 'reject-flush-stop-affected-lease-clear-queued-output',
      pendingTargetErrorReplay: 'next-flush-rejects-once-then-retry',
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
    contract.size?.maximumBytes === 10240 &&
    contract.size?.singleStyleMaximumBytes ===
      768, 'size contract must enforce 10,240 root bytes and 768 single-style bytes using gzip level 9', failures)
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
    stream: 'process.stderr',
    color: 'cyan',
    unicode: 'auto',
    hideCursor: true,
    indent: 0,
    prefix: '',
    suffix: '',
    spinner: 'dots',
    static: 'symbol',
    terminal: 'auto',
    intervalMs: 80,
    groupMaxRows: 'min(10, target.rows - 1)',
    progressBarWidth: 20,
    progressStyle: 'blocks',
  }), 'spinner defaults must match the frozen values', failures)
  require(contract.rendering?.defaultStream === 'process.stderr' &&
    contract.rendering?.defaultStdoutWrites === false &&
    contract.rendering?.explicitWritableStreams === true &&
    contract.rendering?.globalWritePatching === false &&
    contract.rendering?.stdinManagement ===
      false, 'renderer must default to stderr without owning output globals or stdin', failures)
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
  require(contract.writeFailures?.backpressure === 'coalesce-cosmetic-frames-until-drain' &&
    contract.writeFailures?.permanentLinesPreserveOrder === true &&
    contract.writeFailures?.unboundedWriteQueue === false &&
    contract.writeFailures?.failureScope ===
      'affected-target-surface-only', 'backpressure must stay bounded and target-local', failures)
  require(Array.isArray(contract.deferred) &&
    contract.deferred.length === 5 &&
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

export { DOCUMENT_PATHS, STATES, STYLE_EXPORTS, TYPE_EXPORTS }
