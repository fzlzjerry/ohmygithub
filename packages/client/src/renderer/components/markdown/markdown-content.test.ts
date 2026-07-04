import { describe, expect, it } from 'vitest'
import { sanitizeHtmlContent } from 'markstream-vue'
import {
  allowGitHubHtmlTags,
  collapseDetailsSummaryGaps,
  convertGitHubAlerts,
  dedentHtmlContinuationLines,
  unwrapSubWrappedBadges,
} from './markdown-content'

describe('unwrapSubWrappedBadges', () => {
  it('unwraps a codex priority badge from nested sub tags', () => {
    const content = '**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Recompute canonical fragment hashes**'

    expect(unwrapSubWrappedBadges(content)).toBe(
      '**![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)  Recompute canonical fragment hashes**',
    )
  })

  it('unwraps a single sub wrapper', () => {
    const content = '<sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub> title'

    expect(unwrapSubWrappedBadges(content)).toBe(
      '![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat) title',
    )
  })

  it('leaves sub tags without shields badges untouched', () => {
    const content = 'H<sub>2</sub>O and <sub>![logo](https://example.com/logo.png)</sub>'

    expect(unwrapSubWrappedBadges(content)).toBe(content)
  })
})

describe('allowGitHubHtmlTags', () => {
  it('keeps picture/source markup renderable under the safe policy', () => {
    allowGitHubHtmlTags()

    const sanitized = sanitizeHtmlContent(
      '<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="https://example.com/dark.svg">\n  <img alt="snake" src="https://example.com/light.svg">\n</picture>',
      'safe',
    )

    expect(sanitized).toContain('<picture>')
    expect(sanitized).toContain('<source media=')
    expect(sanitized).not.toContain('&lt;')
  })

  it('keeps center and del renderable under the safe policy', () => {
    allowGitHubHtmlTags()

    const sanitized = sanitizeHtmlContent(
      '<center><del>old</del><img src="https://example.com/x.png"></center>',
      'safe',
    )

    expect(sanitized).toContain('<center>')
    expect(sanitized).toContain('<del>')
    expect(sanitized).not.toContain('&lt;')
  })

  it('still blocks tags GitHub does not allow', () => {
    allowGitHubHtmlTags()

    expect(sanitizeHtmlContent('<iframe src="https://example.com"></iframe>', 'safe')).not.toContain('<iframe')
  })
})

describe('dedentHtmlContinuationLines', () => {
  it('caps indentation of nested html lines so they cannot become indented code', () => {
    const content = '<p>\n  <a href="https://example.com">\n    <img src="https://example.com/badge.svg" />\n  </a>\n</p>'

    expect(dedentHtmlContinuationLines(content)).toBe(
      '<p>\n  <a href="https://example.com">\n   <img src="https://example.com/badge.svg" />\n  </a>\n</p>',
    )
  })

  it('dedents wrapped attribute lines inside an html block', () => {
    const content = '<picture>\n    <source\n      srcset="https://example.com/dark.svg"\n    />\n</picture>'

    expect(dedentHtmlContinuationLines(content)).toBe(
      '<picture>\n   <source\n   srcset="https://example.com/dark.svg"\n   />\n</picture>',
    )
  })

  it('decodes nbsp entities inside html blocks', () => {
    expect(dedentHtmlContinuationLines('<p>\n  &nbsp;\n</p>')).toBe('<p>\n  \u00A0\n</p>')
  })

  it('leaves fenced code blocks untouched', () => {
    const content = '```html\n<div>\n    <img src="x" />\n</div>\n```'

    expect(dedentHtmlContinuationLines(content)).toBe(content)
  })

  it('leaves indented code blocks outside html untouched', () => {
    const content = 'Example:\n\n    const x = 1\n    console.log(x)'

    expect(dedentHtmlContinuationLines(content)).toBe(content)
  })

  it('stops treating lines as html after a blank line', () => {
    const content = '<div>\n</div>\n\n    indented code\n'

    expect(dedentHtmlContinuationLines(content)).toBe(content)
  })

  it('leaves nbsp outside html blocks untouched', () => {
    expect(dedentHtmlContinuationLines('plain &nbsp; text')).toBe('plain &nbsp; text')
  })
})

describe('convertGitHubAlerts', () => {
  it('rewrites a github tip alert into an admonition container', () => {
    const content = '> [!TIP]  \n> I do provide consulting, contact me at [x](mailto:x@y.z)\n\nAfter'

    expect(convertGitHubAlerts(content)).toBe(
      '::: tip Tip\nI do provide consulting, contact me at [x](mailto:x@y.z)\n:::\n\nAfter',
    )
  })

  it('maps important to the info kind but keeps the github label', () => {
    expect(convertGitHubAlerts('> [!IMPORTANT]\n> read this')).toBe('::: info Important\nread this\n:::')
  })

  it('keeps multi-line bodies and stops at the end of the blockquote', () => {
    const content = '> [!NOTE]\n> line one\n> line two\nplain text'

    expect(convertGitHubAlerts(content)).toBe('::: note Note\nline one\nline two\n:::\nplain text')
  })

  it('leaves regular blockquotes untouched', () => {
    const content = '> Just a quote\n> with two lines'

    expect(convertGitHubAlerts(content)).toBe(content)
  })

  it('leaves alert-looking lines inside fenced code untouched', () => {
    const content = '```md\n> [!TIP]\n> body\n```'

    expect(convertGitHubAlerts(content)).toBe(content)
  })
})

describe('collapseDetailsSummaryGaps', () => {
  it('removes blank lines between details and summary', () => {
    const content = '<details>\n\n<summary> Major in AI </summary>\n\n + Learning\n\n</details>'

    expect(collapseDetailsSummaryGaps(content)).toBe(
      '<details>\n<summary> Major in AI </summary>\n\n + Learning\n\n</details>',
    )
  })

  it('keeps already-tight details blocks unchanged', () => {
    const content = '<details>\n<summary>Tight</summary>\n\ncontent\n\n</details>'

    expect(collapseDetailsSummaryGaps(content)).toBe(content)
  })

  it('preserves details attributes', () => {
    const content = '<details open>\n\n\n<summary>Open</summary>\n</details>'

    expect(collapseDetailsSummaryGaps(content)).toBe('<details open>\n<summary>Open</summary>\n</details>')
  })
})
