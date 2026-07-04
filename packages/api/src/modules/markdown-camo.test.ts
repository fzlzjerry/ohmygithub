import { describe, expect, it } from 'vitest'
import { rewriteImagesToCamo } from './markdown-camo'

const CAMO_A = 'https://camo.githubusercontent.com/aaa111/68747470'
const CAMO_B = 'https://camo.githubusercontent.com/bbb222/68747471'

describe('rewriteImagesToCamo', () => {
  it('maps img data-canonical-src pairs into the markdown', () => {
    const markdown = '![stats](https://stats.example.com/api?user=a&theme=dark)'
    const html = `<img src="${CAMO_A}" data-canonical-src="https://stats.example.com/api?user=a&amp;theme=dark" alt="stats">`

    expect(rewriteImagesToCamo(markdown, html)).toBe(`![stats](${CAMO_A})`)
  })

  it('maps source srcset pairs used by picture themes', () => {
    const markdown = '<source srcset="https://stats.example.com/api?theme=dark" media="(prefers-color-scheme: dark)">'
    const html = `<source srcset="${CAMO_A}" media="(prefers-color-scheme: dark)" data-canonical-src="https://stats.example.com/api?theme=dark">`

    expect(rewriteImagesToCamo(markdown, html)).toBe(
      `<source srcset="${CAMO_A}" media="(prefers-color-scheme: dark)">`,
    )
  })

  it('replaces the longer of two overlapping urls first', () => {
    const markdown = '![a](https://x.example/img) ![b](https://x.example/img?big=1)'
    const html = [
      `<img src="${CAMO_A}" data-canonical-src="https://x.example/img">`,
      `<img src="${CAMO_B}" data-canonical-src="https://x.example/img?big=1">`,
    ].join('')

    expect(rewriteImagesToCamo(markdown, html)).toBe(`![a](${CAMO_A}) ![b](${CAMO_B})`)
  })

  it('returns markdown untouched without rendered html or camo urls', () => {
    const markdown = '![a](https://x.example/img)'

    expect(rewriteImagesToCamo(markdown, null)).toBe(markdown)
    expect(rewriteImagesToCamo(markdown, '<img src="https://x.example/img">')).toBe(markdown)
  })
})
