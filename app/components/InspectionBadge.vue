<script setup lang="ts">
import type { Appointment } from '~/utils/fleet'

const props = defineProps<{ appointment: Appointment, title?: string, compact?: boolean }>()
const status = computed(() => getAppointmentStatus(props.appointment))
const abbreviation = computed(() => getAppointmentShortName(props.appointment.type))
</script>

<template>
  <span :class="`pk pk-${status}`">
    <i aria-hidden="true" :class="{ l: abbreviation.length > 2 }">{{ abbreviation }}</i>
    <span v-if="!compact" class="pk-t">
      <strong>{{ title ?? appointment.type }}</strong>
      <span :class="{ muted: status === 'ok' }"><span :class="`mk mk-${status}`" aria-hidden="true" />{{ getAppointmentText(appointment) }}</span>
    </span>
  </span>
</template>
