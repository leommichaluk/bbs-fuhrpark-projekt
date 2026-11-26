<script setup lang="ts">
const { supabase, db, write, isSaving, currentUser, findVehicle, flashMessage } = useFleet()
const route = useRoute()

const bookableVehicles = computed(() => db.value.vehicles.filter(v => v.pool && v.status === 'verfuegbar'))
const today = currentLocalTime().slice(0, 10)
const tomorrow = addDays(today, 1)
// ?fahrzeug= only preselects a bookable vehicle (an old link may point to one that is now in the workshop)
const requestedVehicle = bookableVehicles.value.find(v => v.id === route.query.fahrzeug)
const form = reactive({
  vehicleId: requestedVehicle?.id ?? bookableVehicles.value[0]?.id ?? '',
  startDate: tomorrow,
  endDate: tomorrow as string | null, // null while only the start day is picked in the calendar
  startTime: '08:00',
  endTime: '16:00',
  purpose: '',
})
const dateFrom = computed(() => `${form.startDate}T${form.startTime}`)
const dateUntil = computed(() => `${form.endDate ?? form.startDate}T${form.endTime}`)
const isSingleDay = computed(() => (form.endDate ?? form.startDate) === form.startDate)
const selectedVehicle = computed(() => findVehicle(form.vehicleId))

const periodError = computed(() =>
  !form.startTime || !form.endTime ? 'Bitte Uhrzeiten für Beginn und Ende wählen.'
    : dateUntil.value <= dateFrom.value ? `Das Ende muss nach dem Beginn liegen (${formatTime(dateFrom.value)} Uhr).`
      : dateFrom.value < currentLocalTime() ? 'Der Beginn liegt in der Vergangenheit.' : '')
const isPeriodValid = computed(() => !periodError.value)
const conflictingBooking = computed(() => isPeriodValid.value ? findOverlappingBooking(db.value.bookings, form.vehicleId, dateFrom.value, dateUntil.value) : undefined)
const freeVehicles = computed(() => isPeriodValid.value
  ? bookableVehicles.value.filter(v => !findOverlappingBooking(db.value.bookings, v.id, dateFrom.value, dateUntil.value))
  : [])
const isFree = (vehicleId: string) => freeVehicles.value.some(v => v.id === vehicleId)
const vehicleBookings = computed(() => db.value.bookings.filter(b => b.vehicleId === form.vehicleId && b.status !== 'storniert'))
// Days on which the selected vehicle is already booked, marked in the calendar
const bookedDays = computed(() => vehicleBookings.value.flatMap(b => eachDay(b.from, b.until)))

// Timeline 06:00–20:00 for a single-day booking
const toPercent = (dateTime: string) => Math.max(0, Math.min(100, (+dateTime.slice(11, 13) * 60 + +dateTime.slice(14, 16) - 360) / 8.4))
const timelinePosition = (from: string, until: string) => {
  const start = from < `${form.startDate}T06:00` ? `${form.startDate}T06:00` : from
  const end = until > `${form.startDate}T20:00` ? `${form.startDate}T20:00` : until
  return { left: `${toPercent(start)}%`, width: `${toPercent(end) - toPercent(start)}%` }
}
const bookingsOnDay = computed(() => vehicleBookings.value.filter(b => b.from < `${form.startDate}T20:00` && `${form.startDate}T06:00` < b.until))

const saveError = ref('')
const book = async () => {
  if (!isPeriodValid.value || conflictingBooking.value || !selectedVehicle.value) return
  // The DB exclusion constraint is the real guard against overlaps (someone may have booked in the meantime)
  saveError.value = await write(() => supabase.from('buchungen').insert({
    fahrzeug_id: selectedVehicle.value!.id,
    user_id: currentUser.value.id,
    von: toTimestamp(dateFrom.value),
    bis: toTimestamp(dateUntil.value),
    zweck: form.purpose.trim(),
  }))
  if (saveError.value) return
  flashMessage.value = { title: 'Gebucht', text: `${selectedVehicle.value.name} (${selectedVehicle.value.plate}), ${formatPeriod(dateFrom.value, dateUntil.value)} Uhr.` }
  await navigateTo('/buchungen')
}
</script>

<template>
  <main class="main">
    <PageHeader title="Poolfahrzeug buchen" />

    <form class="card form" @submit.prevent="book">
      <div v-if="saveError" class="meld meld-err" role="alert">
        <AppIcon name="error" />
        <span><strong>Buchung fehlgeschlagen</strong>{{ saveError }}</span>
      </div>
      <div v-else-if="conflictingBooking" class="meld meld-err" role="alert">
        <AppIcon name="error" />
        <span><strong>Zeitraum überschneidet sich</strong>Im gewählten Zeitraum ist {{ selectedVehicle?.name }} bereits gebucht ({{ formatPeriod(conflictingBooking.from, conflictingBooking.until) }} Uhr).</span>
      </div>

      <div class="buchen-grid">
        <fieldset class="fs">
          <legend><b>1</b>Fahrzeug</legend>
          <p v-if="isPeriodValid && !freeVehicles.length" class="hin"><AppIcon name="info" />Im gewählten Zeitraum ist kein Poolfahrzeug frei. Bitte wählen Sie einen anderen Zeitraum.</p>
          <div class="wahl">
            <label v-for="option in bookableVehicles" :key="option.id" class="wk">
              <input v-model="form.vehicleId" type="radio" name="vehicle" :value="option.id" required>
              <span class="ico"><VehicleIcon :type="option.type" class="fzi-s" /></span>
              <span class="m">
                <strong>{{ option.name }}</strong>
                <span class="xs muted">{{ option.type }}</span>
                <span v-if="isPeriodValid" class="xs wk-frei">
                  <span :class="`mk mk-${isFree(option.id) ? 'ok' : 'gebucht'}`" aria-hidden="true" />{{ isFree(option.id) ? 'frei' : 'belegt' }}
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <fieldset class="fs">
          <legend><b>2</b>Zeitraum</legend>
          <DateRangeCalendar v-model:start="form.startDate" v-model:end="form.endDate" :min="today" :marked="bookedDays" />
          <p class="sm" aria-live="polite">
            <template v-if="form.endDate === null"><strong>{{ formatDay(form.startDate) }}</strong> – jetzt Enddatum wählen oder denselben Tag erneut antippen.</template>
            <template v-else>
              <strong>{{ isSingleDay ? formatDay(form.startDate) : `${formatDay(form.startDate)} bis ${formatDay(form.endDate)}` }}</strong>
              <span v-if="bookedDays.length" class="muted"> · <span class="mk mk-gebucht" aria-hidden="true" /> = an dem Tag schon gebucht</span>
            </template>
          </p>
          <div class="f2">
            <div class="feld" :class="{ err: conflictingBooking || periodError.includes('Vergangenheit') }">
              <label for="start-time">Beginn</label>
              <input id="start-time" v-model="form.startTime" class="inp num" type="time" step="900" required aria-describedby="period-message">
            </div>
            <div class="feld" :class="{ err: conflictingBooking || periodError.includes('Ende') }">
              <label for="end-time">Ende</label>
              <input id="end-time" v-model="form.endTime" class="inp num" type="time" step="900" required aria-describedby="period-message">
            </div>
          </div>
          <span v-if="periodError" id="period-message" class="ferr"><AppIcon name="error" />{{ periodError }}</span>
          <span v-else-if="conflictingBooking" id="period-message" class="ferr"><AppIcon name="error" />Frei ab {{ formatDay(conflictingBooking.until) }}, {{ formatTime(conflictingBooking.until) }} Uhr – oder wählen Sie ein anderes Fahrzeug.</span>
          <div v-if="selectedVehicle && isSingleDay && form.endDate !== null">
            <div class="row-sb" style="margin-bottom: 8px">
              <span class="lbl b sm">Belegung {{ selectedVehicle.name }} · {{ formatDay(form.startDate) }}</span>
              <span class="row xs" style="gap: 14px">
                <span class="row" style="gap: 6px"><span class="mk mk-gebucht" aria-hidden="true" />gebucht</span>
                <span class="row" style="gap: 6px"><span style="width: 14px; height: 10px; border: 2px dashed var(--rot); border-radius: 3px" aria-hidden="true" />Ihre Auswahl</span>
              </span>
            </div>
            <div class="zl" role="img" :aria-label="`${bookingsOnDay.length} Buchungen an diesem Tag${conflictingBooking ? ', Ihre Auswahl überschneidet sich' : ''}`">
              <div v-for="booking in bookingsOnDay" :key="booking.id" class="zl-blk zl-belegt" :style="{ ...timelinePosition(booking.from, booking.until), justifyContent: 'flex-end' }">gebucht {{ formatTime(booking.from) }}–{{ formatTime(booking.until) }}</div>
              <div v-if="isPeriodValid" class="zl-blk" :class="conflictingBooking ? 'zl-wahl' : 'zl-ok'" :style="timelinePosition(dateFrom, dateUntil)">{{ formatTime(dateFrom) }}–{{ formatTime(dateUntil) }}</div>
            </div>
            <div class="zl-skala"><span v-for="hour in ['06', '08', '10', '12', '14', '16', '18', '20']" :key="hour">{{ hour }}</span></div>
          </div>
        </fieldset>
      </div>

      <fieldset class="fs">
        <legend><b>3</b>Zweck</legend>
        <div class="feld">
          <label for="purpose">Zweck der Fahrt</label>
          <input id="purpose" v-model="form.purpose" class="inp" required>
          <span class="hilfe">Erscheint später im Fahrtenbuch.</span>
        </div>
      </fieldset>

      <div class="form-foot action-bar">
        <button class="btn btn-p" :disabled="!isPeriodValid || !!conflictingBooking || form.endDate === null || isSaving">{{ isSaving ? 'Wird gebucht …' : 'Buchen' }}</button>
        <NuxtLink class="btn btn-g" to="/">Abbrechen</NuxtLink>
      </div>
    </form>
  </main>
</template>
