import { describe, expect, it } from 'vitest'
import {
  createActionRunWorkspaceUrl,
  createWorkspaceTabFromUrl,
  normalizeWorkspaceUrl,
} from './workspace-url'

describe('action run workspace URLs', () => {
  it('preserves the selected workflow job in the query string', () => {
    expect(createActionRunWorkspaceUrl('octo-org', 'hello-world', 123, 456))
      .toBe('/octo-org/hello-world/actions/runs/123?job=456')
    expect(normalizeWorkspaceUrl('/octo-org/hello-world/actions/runs/123?job=456'))
      .toBe('/octo-org/hello-world/actions/runs/123?job=456')
    expect(createWorkspaceTabFromUrl('/octo-org/hello-world/actions/runs/123?job=456'))
      .toMatchObject({
        type: 'action-run',
        owner: 'octo-org',
        repo: 'hello-world',
        runId: 123,
        jobId: 456,
        url: '/octo-org/hello-world/actions/runs/123?job=456',
      })
  })
})
