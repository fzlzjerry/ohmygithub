import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { resolveNotificationTarget } from '@/pages/inbox/inbox-helpers'
import { requestWorkspaceSearch } from '@/pages/workspace/composables/use-workspace-search-request'

export function isInternalWorkspacePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

export function useTrayBridge(): void {
  const router = useRouter()
  const unsubscribers: Array<() => void> = []

  onMounted(() => {
    unsubscribers.push(
      window.ohMyGithub.tray.onNavigate((url) => {
        if (isInternalWorkspacePath(url)) {
          void router.push(url)
        }
      })
    )

    unsubscribers.push(
      window.ohMyGithub.tray.onOpenNotification((payload) => {
        const target = resolveNotificationTarget({
          id: '',
          unread: false,
          reason: 'subscribed',
          updatedAt: '',
          subjectType: payload.subjectType,
          subjectTitle: '',
          repositoryFullName: payload.repositoryFullName,
          repositoryHtmlUrl: '',
          number: payload.number,
          htmlUrl: payload.htmlUrl,
        })
        if (target.kind === 'internal') {
          void router.push(target.url)
        } else {
          void window.ohMyGithub.links.openGitHubUrl(target.url)
        }
      })
    )

    unsubscribers.push(
      window.ohMyGithub.tray.onOpenSearch(() => {
        if (router.currentRoute.value.path !== '/') {
          void router.push('/')
        }
        requestWorkspaceSearch()
      })
    )
  })

  onUnmounted(() => {
    for (const unsubscribe of unsubscribers) unsubscribe()
    unsubscribers.length = 0
  })
}
