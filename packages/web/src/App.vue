<script setup lang="ts">
import FeaturesSection from '@/components/FeaturesSection.vue'
import HeroSection from '@/components/HeroSection.vue'
import SiteFooter from '@/components/SiteFooter.vue'
import TopBar from '@/components/TopBar.vue'
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background text-foreground">
    <TopBar />
    <main class="flex-1">
      <HeroSection />
      <FeaturesSection />
    </main>
    <SiteFooter />
  </div>
</template>
