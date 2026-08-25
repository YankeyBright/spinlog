import spinlog from 'spinlog'

const progress = spinlog
  .progress('Uploading', {
    total: 3,
    style: 'blocks',
    width: 20,
  })
  .start()
progress.increment()
progress.update(2)
progress.succeed('Uploaded')
