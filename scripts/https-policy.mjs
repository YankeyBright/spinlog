const CYCLONEDX_SCHEMA = 'http://cyclonedx.org/schema/bom-1.5.schema.json'
const HTTP_PROTOCOL = 'http:'
const HTTP_PREFIX = `${HTTP_PROTOCOL}//`
const URL_TERMINATORS = new Set(['"', "'", '`', '<', '>', ')'])
const TRAILING_URL_PUNCTUATION = new Set(['.', ',', ';', ':', '!', '?', ']', '}'])

function isUrlTerminator(character) {
  return character.trim().length === 0 || URL_TERMINATORS.has(character)
}

function trimTrailingPunctuation(url) {
  let end = url.length
  while (end > HTTP_PREFIX.length && TRAILING_URL_PUNCTUATION.has(url[end - 1])) end -= 1
  return url.slice(0, end)
}

/** Scan text once so policy checks cannot be amplified by regular-expression backtracking. */
function httpUrls(source) {
  const urls = []
  let searchFrom = 0

  while (searchFrom < source.length) {
    const start = source.indexOf(HTTP_PREFIX, searchFrom)
    if (start === -1) break

    let end = start + HTTP_PREFIX.length
    while (end < source.length) {
      const codePoint = source.codePointAt(end)
      if (codePoint === undefined) break
      const character = String.fromCodePoint(codePoint)
      if (isUrlTerminator(character)) break
      end += character.length
    }

    const url = trimTrailingPunctuation(source.slice(start, end))
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'http:') urls.push(url)
    } catch {
      // A malformed HTTP candidate is still an insecure actionable reference.
      urls.push(url)
    }
    searchFrom = end
  }

  return urls
}

export function validateHttpsPolicy(sources) {
  const failures = []

  for (const [path, source] of Object.entries(sources)) {
    for (const url of httpUrls(source)) {
      if (url !== CYCLONEDX_SCHEMA) failures.push(`${path} must use HTTPS: ${url}`)
    }
  }

  return [...new Set(failures)]
}

export { CYCLONEDX_SCHEMA }
