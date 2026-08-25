import spinlog, {
  bgBlueBright,
  red,
  type FlowOptions,
  type PromiseOptions,
  type PromiseSettlementText,
  type Progress,
  type ProgressOptions,
  type RenderOptions,
  type Spinlog,
  type Spinner,
  type SpinnerColor,
  type SpinnerDefinition,
  type SpinnerGroup,
  type SpinnerName,
  type SpinnerOptions,
  type UnicodeMode,
} from '../../dist/index.js'
import { blue as subpathBlue, type Style } from '../../dist/styles.js'

const name: SpinnerName = 'dots'
const color: SpinnerColor = 'cyanBright'
const options: SpinnerOptions = {
  color,
  prefix: 'prefix',
  spinner: name,
  suffix: 'suffix',
  static: 'text',
  terminal: 'interactive',
  unicode: false,
  hideCursor: false,
  indent: 2,
}
const custom: SpinnerDefinition = { frames: ['-', '+'], interval: 120 }
const customOptions: SpinnerOptions = { spinner: custom }
const settlementText: PromiseSettlementText<number> = (value) => `worked ${value}`
const promiseOptions: PromiseOptions<number> = {
  ...options,
  text: 'working',
  successText: settlementText,
  failText: (error) => String(error),
}
const renderOptions: RenderOptions = { color: false, unicode: 'auto', indent: 1 }
const flowOptions: FlowOptions = { color: false, unicode: false, indent: 1 }
const unicode: UnicodeMode = 'auto'
const factory: Spinlog = spinlog
const spinner: Spinner = factory('working', options)
const group: SpinnerGroup = factory.group({ terminal: 'static', maxRows: 3, color: false })
const groupChild: Spinner = group.add('child', { spinner: custom })
const progressOptions: ProgressOptions = {
  total: 2,
  value: 1,
  terminal: 'static',
  width: 20,
  style: 'ascii',
}
const progress: Progress = factory.progress('copy', progressOptions)
const styled: string = red(bgBlueBright('value'))
const direct: Promise<number> = factory.promise(Promise.resolve(1), promiseOptions)
const task: Promise<string> = factory.promise(() => Promise.resolve('value'))
factory.intro('starting', flowOptions)
factory.outro(undefined, { ...renderOptions, color: 'blue' })
const subpathStyle: Style = subpathBlue

spinner.start().stop().start().succeed().start().fail().start().warn().start().info()
spinner.log('permanent line').start()
groupChild.start().succeed()
group.stop()
progress.increment().update(2).succeed()
const dispose: () => void = spinner[Symbol.dispose]
dispose()
spinner.text = styled
subpathStyle(styled)
await direct
await task

// @ts-expect-error custom spinner names remain a closed union
factory('invalid', { spinner: 'custom' })
// @ts-expect-error custom frames require a non-empty array type
factory('invalid', { spinner: { frames: [] as unknown as string } })
// @ts-expect-error advanced color names are not public
spinner.color = 'orange'
// @ts-expect-error lifecycle methods accept no undocumented options
spinner.start({ interval: 20 })
// @ts-expect-error static mode is a closed union
factory('invalid', { static: 'quiet' })
// @ts-expect-error terminal mode is a closed union
factory('invalid', { terminal: 'force' })
// @ts-expect-error coordinated logging requires text
spinner.log()
// @ts-expect-error flow messages accept strings only
factory.intro(42)
// @ts-expect-error flow options remain a closed object shape
factory.outro('done', { maxRows: 2 })
// @ts-expect-error group child options cannot override the shared group terminal policy
group.add('invalid', { terminal: 'static' })
// @ts-expect-error progress requires a total
factory.progress('invalid', {})
// @ts-expect-error progress values are numbers
progress.update('two')

// @ts-expect-error progress bar style is a closed union
factory.progress('invalid', { total: 1, style: 'gradient' })
// @ts-expect-error group child options cannot override the shared target
group.add('invalid', { stream: process.stderr })

void customOptions
void unicode
