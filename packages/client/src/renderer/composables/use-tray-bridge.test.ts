import { describe, expect, it } from 'vitest'
import { isInternalWorkspacePath } from './use-tray-bridge'

describe('isInternalWorkspacePath', () => {
  it('accepts internal workspace paths', () => {
    expect(isInternalWorkspacePath('/o/r/pull-request/1')).toBe(true)
    expect(isInternalWorkspacePath('/')).toBe(true)
  })

  it('rejects external and protocol-relative URLs', () => {
    expect(isInternalWorkspacePath('https://github.com/o/r')).toBe(false)
    expect(isInternalWorkspacePath('//evil.example.com')).toBe(false)
    expect(isInternalWorkspacePath('javascript:alert(1)')).toBe(false)
    expect(isInternalWorkspacePath('')).toBe(false)
  })
})
