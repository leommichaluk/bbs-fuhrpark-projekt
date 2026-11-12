<script setup lang="ts">
const { db, currentUser, findVehicle } = useFleet()

const openBookings = computed(() => db.value.bookings
  .filter(b => b.userId === currentUser.value.id && (b.status === 'gebucht' || b.status === 'uebernommen'))
  .sort((a, b) => a.from.localeCompare(b.from)))
const allMyTrips = computed(() => db.value.trips
  .filter(t => t.userId === currentUser.value.id)
  .sort((a, b) => b.pickupTime.localeCompare(a.pickupTime)))
const months = computed(() => [...new Set(allMyTrips.value.map(t => t.pickupTime.slice(0, 7)))])
const selectedMonth = ref(months.value[0] ?? '')
const monthLabel = (month: string) => new Date(`${month}-01`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const tripsInMonth = computed(() => allMyTrips.value.filter(t => t.pickupTime.startsWith(selectedMonth.value)))
</script>

<template>
  <main class="main">
    <PageHeader title="Meine Buchungen">
      <NuxtLink class="btn btn-p" to="/buchen"><AppIcon name="plus" />Poolfahrzeug buchen</NuxtLink>
    </PageHeader>

    <section class="card" aria-labelledby="bookings-heading">
      <div class="card-h"><h2 id="bookings-heading">Buchungen</h2></div>
      <EmptyState v-if="!openBookings.length" icon="calendar" title="Noch keine Buchungen" text="Buchen Sie ein Poolfahrzeug, dann erscheint es hier.">
        <NuxtLink class="btn btn-p" to="/buchen">Poolfahrzeug buchen</NuxtLink>
      </EmptyState>
      <div v-for="booking in openBookings" :key="booking.id" class="bk">
        <VehicleChip :vehicle="findVehicle(booking.vehicleId)!" :subtitle="`${findVehicle(booking.vehicleId)!.plate} · ${booking.purpose}`" />
        <span class="d">{{ formatPeriod(booking.from, booking.until) }}</span>
        <StatusBadge status="gebucht" :label="booking.status === 'uebernommen' ? 'läuft' : 'gebucht'" />
        <NuxtLink v-if="booking.status === 'uebernommen'" class="btn btn-p btn-sm" :to="`/fahrt/${booking.id}`">Zurückgeben</NuxtLink>
        <template v-else>
          <NuxtLink v-if="booking.from.slice(0, 10) === NOW.slice(0, 10)" class="btn btn-p btn-sm" :to="`/fahrt/${booking.id}`">Übernehmen</NuxtLink>
          <button type="button" class="btn btn-g btn-sm" @click="booking.status = 'storniert'">Stornieren</button>
        </template>
      </div>
    </section>

    <section class="card" aria-labelledby="trips-heading">
      <div class="card-h">
        <h2 id="trips-heading">Meine Fahrten</h2>
        <label class="vh" for="month">Monat</label>
        <select id="month" v-model="selectedMonth" class="chip">
          <option v-for="month in months" :key="month" :value="month">{{ monthLabel(month) }}</option>
        </select>
      </div>
      <LogbookTable :trips="tripsInMonth" column="vehicle" :total-label="`Summe ${monthLabel(selectedMonth).split(' ')[0]}`" />
    </section>
  </main>
</template>
