<script setup lang="ts">
const { supabase, db, write, currentUser, findVehicle, flashMessage } = useFleet()
const route = useRoute()

const bookableVehicles = computed(() => db.value.vehicles.filter(v => v.pool && v.status === 'verfuegbar'))
const tomorrow = new Date(Date.parse(currentLocalTime().slice(0, 10)) + 864e5).toISOString().slice(0, 10)
const form = reactive({
  vehicleId: (route.query.fahrzeug as string) ?? bookableVehicles.value[0]?.id ?? '',
  dateFrom: `${tomorrow}T08:00`,
  dateUntil: `${tomorrow}T16:00`,
  purpose: '',
})
const selectedVehicle = computed(() => findVehicle(form.vehicleId))

const periodError = computed(() =>
  form.dateFrom && form.dateUntil && form.dateUntil <= form.dateFrom ? `Das Ende muss nach dem Beginn liegen (${formatTime(form.dateFrom)} Uhr).`
    : form.dateFrom && form.dateFrom < currentLocalTime() ? 'Der Beginn liegt in der Vergangenheit.' : '')
const isPeriodValid = computed(() => !!form.dateFrom && !!form.dateUntil && !periodError.value)
const conflictingBooking = computed(() => isPeriodValid.value ? findOverlappingBooking(db.value.bookings, form.vehicleId, form.dateFrom, form.dateUntil) : undefined)
const freeVehicles = computed(() => isPeriodValid.value
  ? bookableVehicles.value.filter(v => !findOverlappingBooking(db.value.bookings, v.id, form.dateFrom, form.dateUntil))
  : [])

// Timeline 06:00–20:00 for the start day
const timelineDay = computed(() => form.dateFrom.slice(0, 10))
const toPercent = (dateTime: string) => Math.max(0, Math.min(100, (+dateTime.slice(11, 13) * 60 + +dateTime.slice(14, 16) - 360) / 8.4))
const timelinePosition = (from: string, until: string) => {
  const start = from < `${timelineDay.value}T06:00` ? `${timelineDay.value}T06:00` : from
  const end = until > `${timelineDay.value}T20:00` ? `${timelineDay.value}T20:00` : until
  return { left: `${toPercent(start)}%`, width: `${toPercent(end) - toPercent(start)}%` }
}
const bookingsOnDay = computed(() => db.value.bookings.filter(b =>
  b.vehicleId === form.vehicleId && b.status !== 'storniert' && b.from < `${timelineDay.value}T20:00` && `${timelineDay.value}T06:00` < b.until))

const saveError = ref('')
const book = async () => {
  if (!isPeriodValid.value || conflictingBooking.value || !selectedVehicle.value) return
  // The DB exclusion constraint is the real guard against overlaps (someone may have booked in the meantime)
  saveError.value = await write(() => supabase.from('buchungen').insert({
    fahrzeug_id: selectedVehicle.value!.id,
    user_id: currentUser.value.id,
    von: toTimestamp(form.dateFrom),
    bis: toTimestamp(form.dateUntil),
    zweck: form.purpose.trim(),
  }))
  if (saveError.value) return
  flashMessage.value = { title: 'Gebucht', text: `${selectedVehicle.value.name} (${selectedVehicle.value.plate}), ${formatPeriod(form.dateFrom, form.dateUntil)} Uhr.` }
  await navigateTo('/buchungen')
}
</script>

<template>
  <main class="main">
    <PageHeader title="Poolfahrzeug buchen" />

    <div class="g-main">
      <form class="card form" @submit.prevent="book">
        <div v-if="saveError" class="meld meld-err" role="alert">
          <AppIcon name="error" />
          <span><strong>Buchung fehlgeschlagen</strong>{{ saveError }}</span>
        </div>
        <div v-else-if="conflictingBooking" class="meld meld-err" role="alert">
          <AppIcon name="error" />
          <span><strong>Zeitraum überschneidet sich</strong>Im gewählten Zeitraum ist {{ selectedVehicle?.plate }} bereits gebucht ({{ formatPeriod(conflictingBooking.from, conflictingBooking.until) }} Uhr).</span>
        </div>

        <fieldset class="fs">
          <legend><b>1</b>Fahrzeug</legend>
          <div class="feld">
            <label for="vehicle">Poolfahrzeug</label>
            <select id="vehicle" v-model="form.vehicleId" class="inp" required>
              <option v-for="option in bookableVehicles" :key="option.id" :value="option.id">{{ option.name }} · {{ option.type }} · {{ option.plate }}</option>
            </select>
          </div>
        </fieldset>

        <fieldset class="fs">
          <legend><b>2</b>Zeitraum</legend>
          <div class="f2">
            <div class="feld" :class="{ err: conflictingBooking || periodError.includes('Vergangenheit') }">
              <label for="date-from">Von</label>
              <input id="date-from" v-model="form.dateFrom" class="inp num" type="datetime-local" required :aria-invalid="!!conflictingBooking" aria-describedby="period-message">
            </div>
            <div class="feld" :class="{ err: conflictingBooking || periodError.includes('Ende') }">
              <label for="date-until">Bis</label>
              <input id="date-until" v-model="form.dateUntil" class="inp num" type="datetime-local" required :aria-invalid="!!conflictingBooking || !!periodError" aria-describedby="period-message">
            </div>
          </div>
          <span v-if="periodError" id="period-message" class="ferr"><AppIcon name="error" />{{ periodError }}</span>
          <span v-else-if="conflictingBooking" id="period-message" class="ferr"><AppIcon name="error" />Frei ab {{ formatDay(conflictingBooking.until) }}, {{ formatTime(conflictingBooking.until) }} Uhr – oder wählen Sie ein anderes Fahrzeug.</span>
          <div v-if="selectedVehicle && form.dateFrom">
            <div class="row-sb" style="margin-bottom: 8px">
              <span class="lbl b sm">Belegung {{ selectedVehicle.plate }} · {{ formatDay(form.dateFrom) }}</span>
              <span class="row xs" style="gap: 14px">
                <span class="row" style="gap: 6px"><span class="mk mk-gebucht" aria-hidden="true" />gebucht</span>
                <span class="row" style="gap: 6px"><span style="width: 14px; height: 10px; border: 2px dashed var(--rot); border-radius: 3px" aria-hidden="true" />Ihre Auswahl</span>
              </span>
            </div>
            <div class="zl" role="img" :aria-label="`${bookingsOnDay.length} Buchungen an diesem Tag${conflictingBooking ? ', Ihre Auswahl überschneidet sich' : ''}`">
              <div v-for="booking in bookingsOnDay" :key="booking.id" class="zl-blk zl-belegt" :style="{ ...timelinePosition(booking.from, booking.until), justifyContent: 'flex-end' }">gebucht {{ formatTime(booking.from) }}–{{ formatTime(booking.until) }}</div>
              <div v-if="isPeriodValid" class="zl-blk" :class="conflictingBooking ? 'zl-wahl' : 'zl-ok'" :style="timelinePosition(form.dateFrom, form.dateUntil)">{{ formatTime(form.dateFrom) }}–{{ formatTime(form.dateUntil) }}</div>
            </div>
            <div class="zl-skala"><span v-for="hour in ['06', '08', '10', '12', '14', '16', '18', '20']" :key="hour">{{ hour }}</span></div>
          </div>
        </fieldset>

        <fieldset class="fs">
          <legend><b>3</b>Zweck</legend>
          <div class="feld">
            <label for="purpose">Zweck der Fahrt</label>
            <input id="purpose" v-model="form.purpose" class="inp" required>
            <span class="hilfe">Erscheint später im Fahrtenbuch.</span>
          </div>
        </fieldset>

        <div class="form-foot">
          <button class="btn btn-p" :disabled="!isPeriodValid || !!conflictingBooking">Buchen</button>
          <NuxtLink class="btn btn-g" to="/">Abbrechen</NuxtLink>
        </div>
      </form>

      <aside class="card" aria-labelledby="free-vehicles-heading">
        <div class="stack-s" style="margin-bottom: 8px">
          <h2 id="free-vehicles-heading" style="font-size: 22px">Im Zeitraum frei</h2>
          <p v-if="isPeriodValid" class="sm muted">{{ formatPeriod(form.dateFrom, form.dateUntil) }} Uhr</p>
        </div>
        <div v-for="vehicle in freeVehicles" :key="vehicle.id" class="alt">
          <VehicleChip :vehicle="vehicle" />
          <button v-if="vehicle.id !== form.vehicleId" type="button" class="btn btn-s btn-sm" @click="form.vehicleId = vehicle.id">Wählen</button>
          <StatusBadge v-else status="ok" label="gewählt" />
        </div>
        <EmptyState
          v-if="isPeriodValid && !freeVehicles.length" style="padding: 24px 0" icon="lock"
          title="Im Zeitraum ist alles belegt" text="Kein Poolfahrzeug ist frei. Bitte wählen Sie einen anderen Zeitraum."
        />
      </aside>
    </div>
  </main>
</template>
