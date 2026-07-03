export function extractIpcErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) return null

  const message = error.message
    .replace(/^Error invoking remote method '[^']+':\s*/, '')
    .replace(/^Error:\s*/, '')
    .trim()

  return message || null
}
