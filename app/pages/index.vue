<script setup lang="ts">
import type { Booking, Vehicle } from '~/utils/fleet'

const { db, currentUser, findVehicle, cancelBooking, isSaving, getStatus, runningBooking } = useFleet()
const confirmDialog = useTemplateRef('confirmDialog')
const cancelError = ref('')
const cancel = async (booking: Booking) => {
  const confirmed = await confirmDialog.value!.ask({
    title: 'Buchung stornieren?',
    text: `${findVehicle(booking.vehicleId)?.name}, ${formatPeriod(booking.from, booking.until)} Uhr. Das Fahrzeug ist danach für andere wieder frei.`,
    confirmLabel: 'Stornieren',
    danger: true,
  })
  if (confirmed) cancelError.value = await cancelBooking(booking.id)
}
const search = ref('')

const myBookings = computed(() => db.value.bookings.filter(b => b.userId === currentUser.value.id).sort((a, b) => a.from.localeCompare(b.from)))
const activeBooking = computed(() => myBookings.value.find(b => b.status === 'uebernommen'))
const activeVehicle = computed(() => activeBooking.value && findVehicle(activeBooking.value.vehicleId))
const pickupMileage = computed(() => db.value.trips.find(t => t.bookingId === activeBooking.value?.id)?.pickupMileage ?? null)
// Expired bookings (never picked up) are not "next" anymore
const nextBooking = computed(() => myBookings.value.find(b => b.status === 'gebucht' && !isExpired(b)))
const isNextReady = computed(() => !!nextBooking.value && canPickUp(nextBooking.value))
const nextVehicle = computed(() => nextBooking.value && findVehicle(nextBooking.value.vehicleId))

const poolVehicles = computed(() => db.value.vehicles.filter(v =>
  v.pool && v.status !== 'ausser_betrieb' && matches(`${v.name} ${v.plate}`, search.value)))
const availabilityToday = (vehicle: Vehicle) => {
  const active = runningBooking(vehicle.id)
  if (active) return `${active.userId === currentUser.value.id ? 'von Ihnen ' : ''}bis ${formatUntil(active.until)}`
  if (vehicle.status === 'in_wartung') return 'in der Werkstatt'
  const nextToday = db.value.bookings.find(b => b.vehicleId === vehicle.id && b.status === 'gebucht' && b.from.slice(0, 10) === currentLocalTime().slice(0, 10) && b.until > currentLocalTime())
  if (!nextToday) return 'ganztägig frei'
  return nextToday.from > currentLocalTime() ? `frei bis ${formatTime(nextToday.from)} Uhr` : `gebucht bis ${formatTime(nextToday.until)} Uhr`
}
</script>

<template>
  <main class="main">
    <div v-if="cancelError" class="meld meld-err" role="alert">
      <AppIcon name="error" />
      <span><strong>Stornieren fehlgeschlagen</strong>{{ cancelError }}</span>
    </div>
    <PageHeader :title="`Guten Tag, ${currentUser.name.split(' ')[0]}`">
      <SearchField v-model="search" label="Fahrzeug suchen" placeholder="Modell oder Kennzeichen suchen" />
    </PageHeader>

    <div class="g-main" style="align-items: stretch">
      <section v-if="activeBooking && activeVehicle" class="card-dark fahrt" aria-labelledby="active-trip-heading" style="padding: 28px">
        <div class="fahrt-face"><VehicleIcon :type="activeVehicle.type" class="fzi-m" /></div>
        <div class="stack" style="flex: 1 1 260px; gap: 12px">
          <StatusBadge status="gebucht" label="Ihre laufende Fahrt" style="align-self: flex-start; background: #fff" />
          <h2 id="active-trip-heading" style="font-size: 30px">{{ activeVehicle.name }}</h2>
          <div class="row" style="gap: 10px"><span class="kzt">{{ activeVehicle.plate }}</span><span class="muted sm">{{ formatDay(activeBooking.from) }} seit {{ formatTime(activeBooking.from) }} · Rückgabe bis {{ formatUntil(activeBooking.until) }}</span></div>
          <div class="row" style="gap: 14px"><span class="sm muted">Übernahme bei</span><Odometer :km="pickupMileage" /></div>
        </div>
        <div class="row" style="flex-basis: 100%; border-top: 1px solid #3A4C66; padding-top: 20px">
          <NuxtLink class="btn btn-p" :to="`/fahrt/${activeBooking.id}`">Fahrzeug zurückgeben</NuxtLink>
          <NuxtLink class="btn btn-s" :to="`/fahrzeuge/${activeVehicle.id}`">Fahrtenbuch ansehen</NuxtLink>
        </div>
      </section>
      <!-- Without a running trip the wide column would stay empty: say what's next instead -->
      <section v-else class="card-dark fahrt" aria-labelledby="no-trip-heading" style="padding: 28px">
        <div class="fahrt-face"><VehicleIcon :type="isNextReady ? nextVehicle!.type : 'Kombi'" class="fzi-m" /></div>
        <div class="stack" style="flex: 1 1 260px; gap: 12px">
          <template v-if="isNextReady">
            <StatusBadge status="ok" label="Bereit zur Übernahme" style="align-self: flex-start; background: #fff" />
            <h2 id="no-trip-heading" style="font-size: 30px">{{ nextVehicle!.name }}</h2>
            <div class="row" style="gap: 10px"><span class="kzt">{{ nextVehicle!.plate }}</span><span class="muted sm">{{ formatPeriod(nextBooking!.from, nextBooking!.until) }} Uhr</span></div>
          </template>
          <template v-else>
            <h2 id="no-trip-heading" style="font-size: 30px">Keine laufende Fahrt</h2>
            <p class="muted">Buchen Sie ein Poolfahrzeug. Zu Beginn der Buchung übernehmen Sie es hier mit dem Kilometerstand.</p>
          </template>
        </div>
        <div class="row" style="flex-basis: 100%; border-top: 1px solid #3A4C66; padding-top: 20px">
          <NuxtLink v-if="isNextReady" class="btn btn-p" :to="`/fahrt/${nextBooking!.id}`">Fahrzeug übernehmen</NuxtLink>
          <NuxtLink v-else class="btn btn-p" to="/buchen">Poolfahrzeug buchen</NuxtLink>
        </div>
      </section>

      <section class="card next" aria-labelledby="next-booking-heading">
        <h2 id="next-booking-heading" style="font-size: 22px">Nächste Buchung</h2>
        <template v-if="nextBooking && nextVehicle">
          <p class="num" style="font-size: 20px; font-weight: 600">{{ formatPeriod(nextBooking.from, nextBooking.until) }}</p>
          <div class="row"><VehicleChip :vehicle="nextVehicle" /></div>
          <p class="sm">Zweck: {{ nextBooking.purpose }}</p>
          <div class="row" style="border-top: 1px solid var(--line); padding-top: 14px">
            <NuxtLink v-if="isNextReady" class="btn btn-p btn-sm" :to="`/fahrt/${nextBooking.id}`">Übernehmen</NuxtLink>
            <NuxtLink class="btn btn-s btn-sm" to="/buchungen">Alle Buchungen</NuxtLink>
            <button type="button" class="btn btn-g btn-sm" :disabled="isSaving" @click="cancel(nextBooking)">Stornieren</button>
          </div>
        </template>
        <template v-else>
          <p class="muted">Keine weitere Buchung.</p>
          <NuxtLink class="btn btn-p btn-sm" to="/buchen" style="align-self: flex-start">Poolfahrzeug buchen</NuxtLink>
        </template>
      </section>
    </div>

    <section aria-labelledby="pool-heading" class="stack" style="gap: 18px">
      <div class="sec-h">
        <h2 id="pool-heading" style="font-size: 26px">Poolfahrzeuge heute</h2>
        <NuxtLink class="btn btn-p" to="/buchen">Poolfahrzeug buchen</NuxtLink>
      </div>
      <EmptyState v-if="!poolVehicles.length" class="card" icon="searchEmpty" title="Kein Fahrzeug gefunden" :text="`Zu „${search}“ passt kein Poolfahrzeug.`">
        <button type="button" class="btn btn-s" @click="search = ''">Suche zurücksetzen</button>
      </EmptyState>
      <div v-else class="fz-grid">
        <div v-for="vehicle in poolVehicles" :key="vehicle.id" class="fz">
          <div class="fz-face"><StatusBadge :status="getStatus(vehicle)" /><VehicleIcon :type="vehicle.type" class="fzi-m" /></div>
          <div class="fz-b">
            <h3>{{ vehicle.name }}</h3>
            <span class="sub">{{ vehicle.type }} · {{ vehicle.seats }} Sitze · {{ vehicle.plate }}</span>
            <span class="tm"><span :class="`mk mk-${getStatus(vehicle)}`" aria-hidden="true" />{{ availabilityToday(vehicle) }}</span>
          </div>
          <!-- A vehicle someone else is driving right now can still be booked for later -->
          <NuxtLink v-if="vehicle.status === 'verfuegbar' && runningBooking(vehicle.id)?.userId !== currentUser.id" class="btn btn-p" :to="`/buchen?fahrzeug=${vehicle.id}`">Buchen</NuxtLink>
          <NuxtLink v-else class="btn btn-s" :to="`/fahrzeuge/${vehicle.id}`">Details</NuxtLink>
        </div>
      </div>
    </section>
    <ConfirmDialog ref="confirmDialog" />
  </main>
</template>
