<script setup lang="ts">
import type { Vehicle } from '~/utils/fleet'

// Small silhouette + model + subline; the parent row (.alt, .bk, .fzc, .next) does the layout
defineProps<{ vehicle: Vehicle, subtitle?: string }>()
</script>

<template>
  <span class="ico"><VehicleIcon :type="vehicle.type" class="fzi-s" /></span>
  <span class="m"><strong>{{ vehicle.name }}</strong><small class="xs muted">{{ subtitle ?? `${vehicle.type} · ${vehicle.plate}` }}</small></span>
</template>
