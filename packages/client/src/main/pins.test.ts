import { describe, expect, it } from 'vitest'
import { normalizePins } from './pins'

describe('normalizePins', () => {
  it('keeps valid organization logins in order', () => {
    expect(normalizePins({ version: 1, organizations: ['vuejs', 'electron'] })).toEqual({
      version: 1,
      organizations: ['vuejs', 'electron']
    })
  })

  it('returns defaults for non-record payloads', () => {
    expect(normalizePins(null)).toEqual({ version: 1, organizations: [] })
    expect(normalizePins('vuejs')).toEqual({ version: 1, organizations: [] })
    expect(normalizePins([['vuejs']])).toEqual({ version: 1, organizations: [] })
  })

  it('returns defaults when organizations is not an array', () => {
    expect(normalizePins({ version: 1, organizations: 'vuejs' })).toEqual({ version: 1, organizations: [] })
    expect(normalizePins({ version: 1 })).toEqual({ version: 1, organizations: [] })
  })

  it('drops non-string and blank entries', () => {
    expect(normalizePins({ version: 1, organizations: ['vuejs', 42, null, '  ', 'electron'] })).toEqual({
      version: 1,
      organizations: ['vuejs', 'electron']
    })
  })

  it('dedupes logins keeping the first occurrence', () => {
    expect(normalizePins({ version: 1, organizations: ['vuejs', 'electron', 'vuejs'] })).toEqual({
      version: 1,
      organizations: ['vuejs', 'electron']
    })
  })
})
