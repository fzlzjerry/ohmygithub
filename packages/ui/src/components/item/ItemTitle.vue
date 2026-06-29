<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '#/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="item-title"
    :class="cn('flex w-fit select-none items-center gap-2 text-control leading-snug font-medium', props.class)"
  >
    <slot />
  </div>
</template>
