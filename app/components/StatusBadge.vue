<script setup lang="ts">
defineProps<{ status: string, label?: string }>()
</script>

<template>
  <span :class="`st st-${status}`"><span :class="`mk mk-${status}`" aria-hidden="true" />{{ label ?? STATUS_LABEL[status] }}</span>
</template>
