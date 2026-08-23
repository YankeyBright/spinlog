import spinlog from 'spinlog'

const spinner = spinlog('Building', {
  color: 'cyan',
  prefix: 'build',
  spinner: 'dots',
}).start()

spinner.text = 'Bundling'
spinner.log('Writing manifest')
spinner.succeed('Built')
