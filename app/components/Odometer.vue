<script setup lang="ts">
const props = withDefaults(defineProps<{ km: number | null, digitCount?: number, separator?: boolean }>(), { digitCount: 6, separator: true })

const digits = computed(() =>
  (props.km === null ? '–'.repeat(props.digitCount) : String(Math.min(props.km, 10 ** props.digitCount - 1)).padStart(props.digitCount, '0')).split(''))
</script>

<template>
  <span class="zw" role="img" :aria-label="km === null ? 'noch nicht berechnet' : `${formatKm(km)} km`">
    <b v-for="(digit, index) in digits" :key="index" :class="{ k: separator && index === digitCount - 3 }">{{ digit }}</b><i>km</i>
  </span>
</template>
