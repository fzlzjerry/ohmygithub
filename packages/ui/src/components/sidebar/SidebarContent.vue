<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { cn } from '#/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const scrollHost = ref<HTMLElement>()
const scrollContent = ref<HTMLElement>()
const scrollMetrics = ref({ clientHeight: 0, scrollHeight: 0, scrollTop: 0 })
const isDraggingScrollbar = ref(false)
let resizeObserver: ResizeObserver | undefined
let dragStartY = 0
let dragStartScrollTop = 0

const hasSidebarOverflow = computed(() =>
  scrollMetrics.value.scrollHeight > scrollMetrics.value.clientHeight + 1,
)

const scrollbarThumbStyle = computed(() => {
  const { clientHeight, scrollHeight, scrollTop } = scrollMetrics.value

  if (!clientHeight || !scrollHeight || scrollHeight <= clientHeight) {
    return {
      height: '0px',
      translate: '0px 0px',
    }
  }

  const thumbHeight = Math.max(24, (clientHeight / scrollHeight) * clientHeight)
  const maxScrollTop = scrollHeight - clientHeight
  const maxThumbOffset = clientHeight - thumbHeight
  const thumbOffset = maxScrollTop > 0 ? (scrollTop / maxScrollTop) * maxThumbOffset : 0

  return {
    height: `${thumbHeight}px`,
    translate: `0px ${thumbOffset}px`,
  }
})

function updateScrollMetrics(): void {
  const element = scrollHost.value
  if (!element) return

  scrollMetrics.value = {
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }
}

function onScrollbarPointerDown(event: PointerEvent): void {
  const element = scrollHost.value
  if (!element || !hasSidebarOverflow.value) return

  event.preventDefault()
  event.stopPropagation()
  isDraggingScrollbar.value = true
  dragStartY = event.clientY
  dragStartScrollTop = element.scrollTop
  window.addEventListener('pointermove', onScrollbarPointerMove)
  window.addEventListener('pointerup', stopScrollbarDrag, { once: true })
  window.addEventListener('pointercancel', stopScrollbarDrag, { once: true })
}

function onScrollbarPointerMove(event: PointerEvent): void {
  const element = scrollHost.value
  if (!element) return

  const { clientHeight, scrollHeight } = scrollMetrics.value
  const thumbHeight = Math.max(24, (clientHeight / scrollHeight) * clientHeight)
  const maxThumbOffset = clientHeight - thumbHeight
  const maxScrollTop = scrollHeight - clientHeight
  const delta = event.clientY - dragStartY
  const scrollDelta = maxThumbOffset > 0 ? (delta / maxThumbOffset) * maxScrollTop : 0

  element.scrollTop = dragStartScrollTop + scrollDelta
  updateScrollMetrics()
}

function stopScrollbarDrag(): void {
  isDraggingScrollbar.value = false
  window.removeEventListener('pointermove', onScrollbarPointerMove)
  window.removeEventListener('pointerup', stopScrollbarDrag)
  window.removeEventListener('pointercancel', stopScrollbarDrag)
}

onMounted(() => {
  nextTick(updateScrollMetrics)
  resizeObserver = new ResizeObserver(updateScrollMetrics)

  if (scrollHost.value) {
    resizeObserver.observe(scrollHost.value)
  }

  if (scrollContent.value) {
    resizeObserver.observe(scrollContent.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  stopScrollbarDrag()
})
</script>

<template>
  <div
    data-slot="sidebar-content"
    data-sidebar="content"
    :class="cn('relative flex min-h-0 flex-1 overflow-hidden group-data-[collapsible=icon]:overflow-hidden', props.class)"
  >
    <div
      ref="scrollHost"
      class="scrollbar-none flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto group-data-[collapsible=icon]:overflow-hidden"
      @scroll="updateScrollMetrics"
    >
      <div
        ref="scrollContent"
        class="flex min-h-full flex-col gap-2"
      >
        <slot />
      </div>
    </div>
    <div
      v-if="hasSidebarOverflow"
      aria-hidden="true"
      class="group/sidebar-scrollbar absolute bottom-1 right-0.5 top-1 z-10 w-1 rounded-sm bg-transparent group-data-[collapsible=icon]:hidden"
      :data-dragging="isDraggingScrollbar ? 'true' : undefined"
    >
      <div
        class="w-full rounded-sm bg-muted-foreground/35 transition-colors group-hover/sidebar-scrollbar:bg-muted-foreground/55 group-data-[dragging=true]/sidebar-scrollbar:bg-muted-foreground/55"
        :style="scrollbarThumbStyle"
        @pointerdown="onScrollbarPointerDown"
      />
    </div>
  </div>
</template>
