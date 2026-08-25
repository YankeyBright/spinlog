import spinlog from 'spinlog'

const spinner = spinlog('Deploying', {
  color: false,
  spinner: { frames: ['.', 'o', 'O', 'o'], interval: 100 },
  unicode: false,
}).start()

spinner.succeed('Deployed')
