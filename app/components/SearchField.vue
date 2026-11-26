<script setup lang="ts">
defineProps<{ label: string, placeholder: string }>()
const query = defineModel<string>({ required: true })
</script>

<template>
  <label class="suche"><span class="vh">{{ label }}</span><input v-model="query" type="search" :placeholder="placeholder"><AppIcon name="search" /></label>
</template>
