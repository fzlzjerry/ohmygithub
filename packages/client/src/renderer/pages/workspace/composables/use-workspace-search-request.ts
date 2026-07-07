import { readonly, ref, type Ref } from 'vue'

// Module singleton: the tray (via use-tray-bridge) fires a search request that the
// workspace page consumes. Because the workspace page may be unmounted when the
// request arrives (e.g. on the settings route), the signal is a monotonic counter
// the page both watches and checks on mount, so a request is never lost.
const searchRequestCount = ref(0)

export function requestWorkspaceSearch(): void {
  searchRequestCount.value += 1
}

export function useWorkspaceSearchRequestSignal(): Readonly<Ref<number>> {
  return readonly(searchRequestCount)
}
