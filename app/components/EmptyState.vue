<script setup lang="ts">
import type { IconName } from '~/components/AppIcon.vue'

defineProps<{ icon: IconName, title: string, text: string }>()
</script>

<template>
  <div class="leer">
    <span class="leer-ic"><AppIcon :name="icon" /></span>
    <h3>{{ title }}</h3>
    <p>{{ text }}</p>
    <slot />
  </div>
</template>
