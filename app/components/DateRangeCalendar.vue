<script setup lang="ts">
// Month calendar for a date range: first click sets the start, second click the end, the next click starts over.
// `end` is null while only the start is picked. `marked` days get a small booking marker.
const start = defineModel<string>('start', { required: true })
const end = defineModel<string | null>('end', { required: true })
const props = defineProps<{ min: string, marked?: string[] }>()

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const month = ref(start.value.slice(0, 7))
const days = computed(() => calendarDays(month.value))
const rangeEnd = computed(() => end.value ?? start.value)
const markedDays = computed(() => new Set(props.marked))
const monthLabel = computed(() => new Date(`${month.value}-01`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' }))
const dayLabel = (day: string) => new Date(day).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  + (markedDays.value.has(day) ? ', Fahrzeug an diesem Tag schon gebucht' : '')

const pick = (day: string) => {
  const next = pickRangeDay({ start: start.value, end: end.value }, day)
  start.value = next.start
  end.value = next.end
}
</script>

<template>
  <div class="kal">
    <div class="kal-h">
      <button type="button" class="btn btn-g btn-sm" aria-label="Vorheriger Monat" :disabled="month <= min.slice(0, 7)" @click="month = shiftMonth(month, -1)">
        <AppIcon name="chevronLeft" />
      </button>
      <strong aria-live="polite">{{ monthLabel }}</strong>
      <button type="button" class="btn btn-g btn-sm" aria-label="Nächster Monat" @click="month = shiftMonth(month, 1)">
        <AppIcon name="chevronRight" />
      </button>
    </div>
    <div class="kal-wt" aria-hidden="true">
      <span v-for="weekday in WEEKDAYS" :key="weekday">{{ weekday }}</span>
    </div>
    <div class="kal-grid">
      <button
        v-for="day in days" :key="day" type="button" class="kal-tag"
        :class="{
          'kal-out': day.slice(0, 7) !== month,
          'kal-heute': day === min,
          'kal-start': day === start,
          'kal-ende': day === rangeEnd,
          'kal-drin': day > start && day < rangeEnd,
          'kal-belegt': markedDays.has(day),
        }"
        :disabled="day < min" :aria-pressed="day >= start && day <= rangeEnd" :aria-label="dayLabel(day)"
        @click="pick(day)"
      >
        {{ +day.slice(8) }}
      </button>
    </div>
  </div>
</template>
