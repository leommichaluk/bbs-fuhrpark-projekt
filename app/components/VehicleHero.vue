<script setup lang="ts">
import type { Vehicle } from '~/utils/fleet'

defineProps<{ vehicle: Vehicle, detail?: string }>()
const { getStatus } = useFleet()
</script>

<template>
  <section class="card hero" aria-labelledby="vehicle-heading">
    <div class="hero-bild"><VehicleIcon :type="vehicle.type" class="fzi-l" /></div>
    <div class="hero-m">
      <h2 id="vehicle-heading" style="font-size: 32px">{{ vehicle.name }}</h2>
      <div class="row" style="gap: 10px"><span class="kzt">{{ vehicle.plate }}</span><span class="muted">{{ vehicle.type }} · {{ vehicle.seats }} Sitze · {{ vehicle.pool ? 'Poolfahrzeug' : 'Dienstwagen' }}</span></div>
      <div class="row">
        <StatusBadge :status="getStatus(vehicle)" />
        <span v-if="detail" class="sm">{{ detail }}</span>
      </div>
    </div>
    <div class="hero-km">
      <span class="xs muted b" style="text-transform: uppercase; letter-spacing: .08em">Kilometerstand</span>
      <Odometer :km="vehicle.mileage" class="zw-l" />
      <slot name="mileage" />
    </div>
    <div v-if="$slots.actions" class="row" style="flex-basis: 100%; border-top: 1px solid var(--line); padding-top: 20px">
      <slot name="actions" />
    </div>
  </section>
</template>
