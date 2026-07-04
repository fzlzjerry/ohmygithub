// github.com serves every external image in rendered markdown through its
// camo CDN (camo.githubusercontent.com); the original hosts are often
// unreachable from the app (rate limits, regional blocks). GitHub's rendered
// HTML keeps the original URL in `data-canonical-src`, so we can map each
// original URL to its signed camo URL and swap them into the raw markdown
// before the client renders it.
export function rewriteImagesToCamo(markdown: string, renderedHtml: string | null | undefined): string {
  if (!markdown || !renderedHtml || !renderedHtml.includes('camo.githubusercontent.com')) {
    return markdown
  }

  const replacements = new Map<string, string>()

  for (const tag of renderedHtml.match(/<(?:img|source)\b[^>]*>/gi) ?? []) {
    const camo = tag.match(/\s(?:src|srcset)="(https:\/\/camo\.githubusercontent\.com\/[^"]+)"/i)?.[1]
    const canonical = tag.match(/\sdata-canonical-src="([^"]+)"/i)?.[1]
    if (!camo || !canonical) continue

    replacements.set(decodeHtmlAttribute(canonical), camo)
  }

  let content = markdown
  // Longest first so a URL that is a prefix of another cannot corrupt it.
  for (const [original, camo] of [...replacements].sort((a, b) => b[0].length - a[0].length)) {
    content = content.split(original).join(camo)
  }

  return content
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}
