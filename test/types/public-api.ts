import spinlog, {
  bgBlueBright,
  red,
  type PromiseOptions,
  type Spinlog,
  type Spinner,
  type SpinnerColor,
  type SpinnerName,
  type SpinnerOptions,
} from '../../dist/index.js'
import { blue as subpathBlue, type Style } from '../../dist/styles.js'

const name: SpinnerName = 'dots'
const color: SpinnerColor = 'cyanBright'
const options: SpinnerOptions = { color, prefix: 'prefix', spinner: name, suffix: 'suffix' }
const promiseOptions: PromiseOptions = { ...options, text: 'working' }
const factory: Spinlog = spinlog
const spinner: Spinner = factory('working', options)
const styled: string = red(bgBlueBright('value'))
const direct: Promise<number> = factory.promise(Promise.resolve(1), promiseOptions)
const task: Promise<string> = factory.promise(() => Promise.resolve('value'))
factory.intro('starting')
factory.outro()
const subpathStyle: Style = subpathBlue

spinner.start().stop().start().succeed().start().fail().start().warn().start().info()
spinner.text = styled
void direct
void task
void subpathStyle

// @ts-expect-error post-MVP task groups are not public
factory.group()
// @ts-expect-error custom spinner names are not public
factory('invalid', { spinner: 'custom' })
// @ts-expect-error advanced color names are not public
spinner.color = 'orange'
// @ts-expect-error lifecycle methods accept no undocumented options
spinner.start({ interval: 20 })
// @ts-expect-error flow messages accept strings only
factory.intro(42)
// @ts-expect-error flow messages expose no options
factory.outro('done', {})
