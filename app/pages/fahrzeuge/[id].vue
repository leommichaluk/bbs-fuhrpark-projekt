<script setup lang="ts">
const { db, currentUser, findVehicle, runningBooking, activeBookings } = useFleet()
const route = useRoute()
const vehicle = computed(() => findVehicle(route.params.id as string))
if (!vehicle.value) throw createError({ statusCode: 404, statusMessage: 'Fahrzeug nicht gefunden' })

const TABS = ['Meine Fahrten', 'Termine', 'Belegung'] as const
const activeTab = ref<typeof TABS[number]>('Meine Fahrten')

const activeBooking = computed(() => runningBooking(vehicle.value!.id))
const heroDetail = computed(() => activeBooking.value
  && `${activeBooking.value.userId === currentUser.value.id ? 'von Ihnen · ' : ''}${formatDay(activeBooking.value.until)} bis ${formatTime(activeBooking.value.until)} Uhr`)
const myTrips = computed(() => db.value.trips
  .filter(t => t.vehicleId === vehicle.value!.id && t.userId === currentUser.value.id)
  .sort((a, b) => b.pickupTime.localeCompare(a.pickupTime)))
const appointments = computed(() => db.value.appointments.filter(a => a.vehicleId === vehicle.value!.id && !a.done))
// Employees only see the periods of other people's bookings, no names (see RLS in migration.md)
const occupancy = computed(() => activeBookings(vehicle.value!.id))
</script>

<template>
  <main v-if="vehicle" class="main">
    <PageHeader title="Fahrzeug" back-to="/" back-label="Übersicht" />

    <VehicleHero :vehicle="vehicle" :detail="heroDetail">
      <template #mileage>
        <NuxtLink v-if="activeBooking?.userId === currentUser.id" class="btn btn-p" :to="`/fahrt/${activeBooking.id}`" style="margin-top: 6px">Fahrzeug zurückgeben</NuxtLink>
        <NuxtLink v-else-if="vehicle.pool && vehicle.status === 'verfuegbar'" class="btn btn-p" :to="`/buchen?fahrzeug=${vehicle.id}`" style="margin-top: 6px">Buchen</NuxtLink>
      </template>
    </VehicleHero>

    <TabBar v-model="activeTab" :tabs="TABS" />

    <section class="card" role="tabpanel" :aria-label="activeTab">
      <template v-if="activeTab === 'Meine Fahrten'">
        <div class="card-h"><h2>Meine Fahrten mit diesem Fahrzeug</h2></div>
        <LogbookTable :trips="myTrips" column="driver" />
        <p class="hin" style="margin-top: 14px"><AppIcon name="info" />Sie sehen nur Ihre eigenen Fahrten. Fahrten anderer Personen sieht nur die Logistik.</p>
      </template>
      <template v-else-if="activeTab === 'Termine'">
        <div class="card-h"><h2>Termine</h2></div>
        <div class="g3">
          <div v-for="appointment in appointments" :key="appointment.id" class="termin"><InspectionBadge :appointment="appointment" /></div>
          <p v-if="!appointments.length" class="muted">Keine Termine hinterlegt.</p>
        </div>
      </template>
      <template v-else>
        <div class="card-h"><h2>Belegung</h2></div>
        <BookingRow v-for="booking in occupancy" :key="booking.id" :booking="booking">
          {{ booking.userId === currentUser.id ? `Sie · ${booking.purpose}` : 'belegt' }}
        </BookingRow>
        <p v-if="!occupancy.length" class="muted">Keine Buchungen – das Fahrzeug ist frei.</p>
      </template>
    </section>
  </main>
</template>
