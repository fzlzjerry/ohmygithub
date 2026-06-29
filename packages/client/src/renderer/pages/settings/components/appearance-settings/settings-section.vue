<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
}>(), {
  title: ''
})
</script>

<template>
  <section class="space-y-2.5">
    <div
      v-if="title || $slots.actions"
      class="flex min-h-7 items-center justify-between gap-4 px-2"
    >
      <h3
        v-if="title"
        class="select-none text-caption font-medium text-muted-foreground"
      >
        {{ title }}
      </h3>
      <slot name="actions" />
    </div>
    <div class="overflow-hidden rounded-[var(--radius-menu-shell)] border border-border bg-card">
      <slot />
    </div>
  </section>
</template>
