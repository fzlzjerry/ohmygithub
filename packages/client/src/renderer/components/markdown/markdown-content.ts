import { SAFE_ALLOWED_HTML_TAGS } from 'markstream-vue'

// markstream's "safe" html policy escapes any tag outside its allowlist into
// visible text, but GitHub's own README sanitizer accepts a wider set (e.g.
// <picture>/<source> theme images, <center>, <del>). Add the difference so
// raw HTML that renders on github.com renders here too.
const GITHUB_ALLOWED_HTML_TAGS = [
  'bdo',
  'center',
  'cite',
  'del',
  'dfn',
  'figcaption',
  'figure',
  'picture',
  'q',
  'rp',
  'rt',
  'ruby',
  'samp',
  'source',
  'strike',
  'time',
  'tt',
  'u',
  'var',
  'video',
  'wbr',
]

export function allowGitHubHtmlTags(): void {
  for (const tag of GITHUB_ALLOWED_HTML_TAGS) SAFE_ALLOWED_HTML_TAGS.add(tag)
}

// A blank line between <details> and <summary> splits them into separate
// html blocks, so <summary> no longer ends up a direct child of <details>
// and the browser falls back to the localized default marker ("Details").
export function collapseDetailsSummaryGaps(content: string): string {
  return content.replace(
    /(<details(?:\s[^>]*)?>)[ \t]*(?:\r?\n[ \t]*){2,}(<summary\b)/gi,
    '$1\n$2',
  )
}

// Inside an HTML block (a line opening with a tag, up to the next blank line)
// leading whitespace carries no meaning, but markstream re-parses the block's
// inner lines as markdown, so a 4-space-indented `<img>` or a wrapped
// attribute line turns into an indented code block. Cap the indent at three
// spaces so the re-parse keeps them as HTML, and decode `&nbsp;` (the raw
// innerHTML path escapes the ampersand, leaving the entity visible as text).
// Fenced code blocks and indented code outside HTML blocks stay untouched.
export function dedentHtmlContinuationLines(content: string): string {
  let inFence = false
  let fenceChar = ''
  let inHtmlBlock = false

  const lines = content.split('\n').map((line) => {
    const trimmed = line.trimEnd()

    if (!inHtmlBlock) {
      const fence = trimmed.match(/^ {0,3}(`{3,}|~{3,})/)
      if (fence) {
        if (!inFence) {
          inFence = true
          fenceChar = fence[1][0]
        } else if (fence[1][0] === fenceChar) {
          inFence = false
        }
        return line
      }
    }
    if (inFence) return line

    if (trimmed === '') {
      inHtmlBlock = false
      return line
    }

    if (!inHtmlBlock) {
      if (!/^ {0,3}<[a-zA-Z!/]/.test(line)) return line
      inHtmlBlock = true
    } else if (/^(?: {4,}| *\t)/.test(line)) {
      line = line.replace(/^\s+/, '   ')
    }

    return line.replace(/&nbsp;/g, '\u00A0')
  })

  return lines.join('\n')
}

// The markdown pipeline renders `html_inline` nodes from their raw content string,
// which collapses a nested markdown image to its alt text. Codex (and similar bots)
// wrap shields.io priority badges in `<sub>` tags, so unwrap those to let the image
// reach the custom image component.
export function unwrapSubWrappedBadges(content: string): string {
  return content.replace(
    /<sub>\s*(?:<sub>\s*)?(!\[[^\]]*\]\(https?:\/\/img\.shields\.io\/[^)]+\))\s*(?:<\/sub>\s*)?<\/sub>/gi,
    '$1',
  )
}

// GitHub renders blockquote alerts (`> [!TIP]`) as styled callouts; markstream
// only understands `::: kind` admonition containers, so rewrite one into the
// other. IMPORTANT has no markstream kind, so it borrows `info` styling while
// keeping GitHub's label via the container title.
const GITHUB_ALERT_KINDS: Record<string, { kind: string; title: string }> = {
  caution: { kind: 'caution', title: 'Caution' },
  important: { kind: 'info', title: 'Important' },
  note: { kind: 'note', title: 'Note' },
  tip: { kind: 'tip', title: 'Tip' },
  warning: { kind: 'warning', title: 'Warning' },
}

export function convertGitHubAlerts(content: string): string {
  const lines = content.split('\n')
  const out: string[] = []
  let inFence = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^ {0,3}(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }

    const marker = line.match(/^ {0,3}>\s*\[!([a-z]+)\]\s*$/i)
    const alert = marker ? GITHUB_ALERT_KINDS[marker[1].toLowerCase()] : undefined
    if (!alert) {
      out.push(line)
      continue
    }

    const body: string[] = []
    let j = i + 1
    while (j < lines.length && /^ {0,3}>/.test(lines[j])) {
      body.push(lines[j].replace(/^ {0,3}> ?/, ''))
      j += 1
    }
    out.push(`::: ${alert.kind} ${alert.title}`, ...body, ':::')
    i = j - 1
  }

  return out.join('\n')
}

// Everything GitHub-flavoured markdown needs before it reaches markstream.
export function prepareGitHubMarkdown(content: string): string {
  return unwrapSubWrappedBadges(
    collapseDetailsSummaryGaps(dedentHtmlContinuationLines(convertGitHubAlerts(content))),
  )
}
