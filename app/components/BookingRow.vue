<script setup lang="ts">
import type { Booking } from '~/utils/fleet'

defineProps<{ booking: Booking }>()
</script>

<template>
  <div class="bu">
    <span class="d">{{ formatPeriod(booking.from, booking.until) }}</span>
    <StatusBadge status="gebucht" :label="booking.status === 'uebernommen' ? 'läuft' : 'gebucht'" />
    <span><slot /></span>
  </div>
</template>
