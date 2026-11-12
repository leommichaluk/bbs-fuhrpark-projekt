<script setup lang="ts">
import type { Trip } from '~/utils/fleet'

const props = defineProps<{ trips: Trip[], column: 'driver' | 'vehicle', totalLabel?: string }>()
const { findVehicle, userName } = useFleet()

const distance = (trip: Trip) => trip.returnMileage == null ? null : trip.returnMileage - trip.pickupMileage
const totalDistance = computed(() => props.trips.reduce((sum, trip) => sum + (distance(trip) ?? 0), 0))
</script>

<template>
  <div class="fb-wrap">
    <table class="fb">
      <thead>
        <tr>
          <th scope="col">Datum</th>
          <th scope="col">{{ column === 'driver' ? 'Fahrer' : 'Fahrzeug' }}</th>
          <th scope="col" class="n">km Übernahme</th>
          <th scope="col" class="n">km Rückgabe</th>
          <th scope="col" class="n">gefahren</th>
          <th scope="col">Zweck</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="trip in trips" :key="trip.id">
          <td class="num">{{ formatDate(trip.pickupTime) }}</td>
          <td>{{ column === 'driver' ? userName(trip.userId) : findVehicle(trip.vehicleId)?.plate }}</td>
          <td class="n">{{ formatKm(trip.pickupMileage) }}</td>
          <template v-if="trip.returnMileage == null">
            <td class="n muted">läuft</td>
            <td class="n muted">–</td>
          </template>
          <template v-else>
            <td class="n">{{ formatKm(trip.returnMileage) }}</td>
            <td class="n gef">{{ formatKm(distance(trip)!) }}</td>
          </template>
          <td>{{ trip.purpose }}</td>
        </tr>
        <tr v-if="!trips.length">
          <td colspan="6" class="muted">Noch keine Fahrten.</td>
        </tr>
      </tbody>
      <tfoot v-if="totalLabel && trips.length">
        <tr>
          <td colspan="4">{{ totalLabel }}</td>
          <td class="n gef">{{ formatKm(totalDistance) }}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  </div>
</template>
