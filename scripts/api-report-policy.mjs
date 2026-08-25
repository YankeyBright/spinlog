export function semanticTokensFromReport(report, path = '<api-report>') {
  const declaration = report.match(/```ts\r?\n([\s\S]*?)\r?\n```/u)?.[1]
  if (declaration === undefined) {
    throw new Error(`API report does not contain a TypeScript declaration block: ${path}`)
  }
  return new DeclarationScanner(declaration, path).tokens()
}

class DeclarationScanner {
  constructor(source, path) {
    this.source = source
    this.path = path
    this.index = 0
  }

  tokens() {
    const tokens = []
    while (this.index < this.source.length) {
      const token = this.nextToken(tokens.at(-1))
      if (token !== undefined) tokens.push(token)
    }
    return tokens
  }

  nextToken(previousToken) {
    const character = this.source[this.index]
    if (/\s/u.test(character) || character === ';') return this.skipCharacter()
    if (this.hasPrefix('//')) return this.skipLineComment()
    if (this.hasPrefix('/*')) return this.skipBlockComment()
    if (character === "'" || character === '"' || character === '`') return this.readString()
    if (/[A-Za-z_$]/u.test(character)) return `word:${this.readWhile(/[A-Za-z\d_$]/u)}`
    if (/\d/u.test(character)) return `number:${this.readWhile(/[\dA-Za-z_.]/u)}`
    return this.readPunctuation(previousToken)
  }

  hasPrefix(prefix) {
    return this.source.startsWith(prefix, this.index)
  }

  skipCharacter() {
    this.index += 1
    return undefined
  }

  skipLineComment() {
    const newline = this.source.indexOf('\n', this.index + 2)
    this.index = newline === -1 ? this.source.length : newline
    return undefined
  }

  skipBlockComment() {
    const end = this.source.indexOf('*/', this.index + 2)
    if (end === -1) throw new Error(`Unterminated block comment in API report: ${this.path}`)
    this.index = end + 2
    return undefined
  }

  readString() {
    const quote = this.source[this.index]
    let value = ''
    this.index += 1
    while (this.index < this.source.length && this.source[this.index] !== quote) {
      if (this.source[this.index] === '\\' && this.index + 1 < this.source.length) {
        value += this.source[this.index + 1]
        this.index += 2
      } else {
        value += this.source[this.index]
        this.index += 1
      }
    }
    if (this.source[this.index] !== quote) {
      throw new Error(`Unterminated string in API report: ${this.path}`)
    }
    this.index += 1
    return `string:${value}`
  }

  readWhile(pattern) {
    const start = this.index
    this.index += 1
    while (this.index < this.source.length && pattern.test(this.source[this.index])) {
      this.index += 1
    }
    return this.source.slice(start, this.index)
  }

  readPunctuation(previousToken) {
    const character = this.source[this.index]
    this.index += 1
    if (character === '|' && previousToken === 'punctuation:=') return undefined
    if (character === ',' && /[\])}]/u.test(this.nextNonWhitespaceCharacter())) return undefined
    return `punctuation:${character}`
  }

  nextNonWhitespaceCharacter() {
    let index = this.index
    while (index < this.source.length && /\s/u.test(this.source[index])) index += 1
    return this.source[index] ?? ''
  }
}
