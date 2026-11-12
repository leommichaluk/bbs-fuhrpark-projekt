<script setup lang="ts">
import type { Vehicle } from '~/utils/fleet'

const { db, currentUser, findVehicle, getStatus, runningBooking } = useFleet()
const search = ref('')

const myBookings = computed(() => db.value.bookings.filter(b => b.userId === currentUser.value.id).sort((a, b) => a.from.localeCompare(b.from)))
const activeBooking = computed(() => myBookings.value.find(b => b.status === 'uebernommen'))
const activeVehicle = computed(() => activeBooking.value && findVehicle(activeBooking.value.vehicleId))
const pickupMileage = computed(() => db.value.trips.find(t => t.bookingId === activeBooking.value?.id)?.pickupMileage ?? null)
const nextBooking = computed(() => myBookings.value.find(b => b.status === 'gebucht'))
const nextVehicle = computed(() => nextBooking.value && findVehicle(nextBooking.value.vehicleId))

const poolVehicles = computed(() => db.value.vehicles.filter(v =>
  v.pool && v.status !== 'ausser_betrieb' && matches(`${v.model} ${v.plate}`, search.value)))
const availabilityToday = (vehicle: Vehicle) => {
  const active = runningBooking(vehicle.id)
  if (active) return `${active.userId === currentUser.value.id ? 'von Ihnen ' : ''}bis ${formatUntil(active.until)}`
  if (vehicle.status === 'in_wartung') return 'in der Werkstatt'
  const nextToday = db.value.bookings.find(b => b.vehicleId === vehicle.id && b.status === 'gebucht' && b.from.slice(0, 10) === NOW.slice(0, 10) && b.until > NOW)
  if (!nextToday) return 'ganztägig frei'
  return nextToday.from > NOW ? `frei bis ${formatTime(nextToday.from)} Uhr` : `gebucht bis ${formatTime(nextToday.until)} Uhr`
}
</script>

<template>
  <main class="main">
    <PageHeader :title="`Guten Tag, ${currentUser.name.split(' ')[0]}`">
      <SearchField v-model="search" label="Fahrzeug suchen" placeholder="Modell oder Kennzeichen suchen" />
    </PageHeader>

    <div class="g-main" style="align-items: stretch">
      <section v-if="activeBooking && activeVehicle" class="card-dark fahrt" aria-labelledby="active-trip-heading" style="padding: 28px">
        <div class="fahrt-face"><VehicleIcon :type="activeVehicle.type" class="fzi-m" /></div>
        <div class="stack" style="flex: 1 1 260px; gap: 12px">
          <StatusBadge status="gebucht" label="Ihre laufende Fahrt" style="align-self: flex-start; background: #fff" />
          <h2 id="active-trip-heading" style="font-size: 30px">{{ activeVehicle.model }}</h2>
          <div class="row" style="gap: 10px"><span class="kzt">{{ activeVehicle.plate }}</span><span class="muted sm">{{ formatDay(activeBooking.from) }} seit {{ formatTime(activeBooking.from) }} · Rückgabe bis {{ formatUntil(activeBooking.until) }}</span></div>
          <div class="row" style="gap: 14px"><span class="sm muted">Übernahme bei</span><Odometer :km="pickupMileage" /></div>
        </div>
        <div class="row" style="flex-basis: 100%; border-top: 1px solid #3A4C66; padding-top: 20px">
          <NuxtLink class="btn btn-p" :to="`/fahrt/${activeBooking.id}`">Fahrzeug zurückgeben</NuxtLink>
          <NuxtLink class="btn btn-s" :to="`/fahrzeuge/${activeVehicle.id}`">Fahrtenbuch ansehen</NuxtLink>
        </div>
      </section>

      <section class="card next" aria-labelledby="next-booking-heading">
        <h2 id="next-booking-heading" style="font-size: 22px">Nächste Buchung</h2>
        <template v-if="nextBooking && nextVehicle">
          <p class="num" style="font-size: 20px; font-weight: 600">{{ formatPeriod(nextBooking.from, nextBooking.until) }}</p>
          <div class="row"><VehicleChip :vehicle="nextVehicle" /></div>
          <p class="sm">Zweck: {{ nextBooking.purpose }}</p>
          <div class="row" style="border-top: 1px solid var(--line); padding-top: 14px">
            <NuxtLink class="btn btn-s btn-sm" to="/buchungen">Alle Buchungen</NuxtLink>
            <button type="button" class="btn btn-g btn-sm" @click="nextBooking.status = 'storniert'">Stornieren</button>
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
            <h3>{{ vehicle.model }}</h3>
            <span class="sub">{{ vehicle.type }} · {{ vehicle.seats }} Sitze · {{ vehicle.plate }}</span>
            <span class="tm"><span :class="`mk mk-${getStatus(vehicle)}`" aria-hidden="true" />{{ availabilityToday(vehicle) }}</span>
          </div>
          <NuxtLink v-if="getStatus(vehicle) === 'ok'" class="btn btn-p" :to="`/buchen?fahrzeug=${vehicle.id}`">Buchen</NuxtLink>
          <NuxtLink v-else class="btn btn-s" :to="`/fahrzeuge/${vehicle.id}`">Details</NuxtLink>
        </div>
      </div>
    </section>
  </main>
</template>
