<script setup lang="ts">
import type { DisplayStatus, Vehicle } from '~/utils/fleet'

const { db, getStatus, userName, runningBooking, dueAppointments } = useFleet()

const EMPTY_FILTER = { status: null as DisplayStatus | null, type: '', usage: '', onlyDue: false, search: '' }
const filter = reactive({ ...EMPTY_FILTER })
const viewMode = ref<'table' | 'cards'>('table')

const statusCounts = computed(() => (['ok', 'gebucht', 'werkstatt', 'aus'] as const).map(status => ({ status, count: db.value.vehicles.filter(v => getStatus(v) === status).length })))
const filteredVehicles = computed(() => db.value.vehicles.filter(v =>
  (!filter.status || getStatus(v) === filter.status)
  && (!filter.type || v.type === filter.type)
  && (!filter.usage || v.pool === (filter.usage === 'pool'))
  && (!filter.onlyDue || dueAppointments(v.id).length)
  && matches(`${v.name} ${v.plate}`, filter.search)))
const isFiltered = computed(() => JSON.stringify(filter) !== JSON.stringify(EMPTY_FILTER))

const subtitle = (vehicle: Vehicle) => `${vehicle.type}${vehicle.pool ? ' · Pool' : ''} · ${vehicle.plate}`
const statusDetail = (vehicle: Vehicle) => {
  const activeBooking = runningBooking(vehicle.id)
  return activeBooking ? `${shortName(userName(activeBooking.userId))} · bis ${formatUntil(activeBooking.until)}` : vehicle.statusNote ?? ''
}
</script>

<template>
  <main class="main">
    <PageHeader title="Fahrzeuge">
      <SearchField v-model="filter.search" label="Fahrzeug suchen" placeholder="Modell oder Kennzeichen suchen" />
    </PageHeader>

    <section aria-label="Lage – zugleich Filter">
      <div class="lage">
        <button v-for="item in statusCounts" :key="item.status" type="button" class="lage-b" :aria-pressed="filter.status === item.status" @click="filter.status = filter.status === item.status ? null : item.status">
          <span class="n">{{ item.count }}</span>
          <span class="l"><span :class="`mk mk-${item.status}`" aria-hidden="true" />{{ STATUS_LABEL[item.status] }}</span>
        </button>
      </div>
    </section>

    <div class="filter">
      <label class="vh" for="filter-type">Fahrzeuggröße</label>
      <select id="filter-type" v-model="filter.type" class="chip">
        <option value="">Größe: alle</option>
        <option v-for="type in VEHICLE_TYPES" :key="type">{{ type }}</option>
      </select>
      <label class="vh" for="filter-usage">Nutzung</label>
      <select id="filter-usage" v-model="filter.usage" class="chip">
        <option value="">Nutzung: alle</option>
        <option value="pool">Poolfahrzeuge</option>
        <option value="company">Dienstwagen</option>
      </select>
      <button type="button" class="chip" :class="{ 'chip-on': filter.onlyDue }" :aria-pressed="filter.onlyDue" @click="filter.onlyDue = !filter.onlyDue">Nur fällige Termine</button>
      <span class="spacer" />
      <div class="seg" role="group" aria-label="Ansicht">
        <button type="button" :aria-pressed="viewMode === 'table'" @click="viewMode = 'table'"><AppIcon name="table" />Tabelle</button>
        <button type="button" :aria-pressed="viewMode === 'cards'" @click="viewMode = 'cards'"><AppIcon name="grid" />Karten</button>
      </div>
      <NuxtLink class="btn btn-p" to="/admin/fahrzeuge/neu/bearbeiten"><AppIcon name="plus" />Fahrzeug anlegen</NuxtLink>
    </div>

    <section :class="viewMode === 'table' ? 'card' : 'stack'" aria-labelledby="list-heading">
      <div :class="viewMode === 'table' ? 'card-h' : 'sec-h'">
        <h2 id="list-heading">{{ filteredVehicles.length }} Fahrzeuge{{ filter.status ? ` · ${STATUS_LABEL[filter.status]}` : '' }}</h2>
        <button v-if="isFiltered" type="button" class="btn btn-g btn-sm" @click="Object.assign(filter, EMPTY_FILTER)">Filter zurücksetzen</button>
      </div>

      <EmptyState v-if="!filteredVehicles.length" icon="searchEmpty" title="Kein Fahrzeug gefunden" text="Zu den gewählten Filtern passt kein Fahrzeug." />

      <div v-else-if="viewMode === 'table'" class="tb-wrap">
        <table class="tb">
          <thead>
            <tr><th scope="col">Fahrzeug</th><th scope="col">Status</th><th scope="col">Kilometerstand</th><th scope="col">Termine</th><th scope="col"><span class="vh">Aktion</span></th></tr>
          </thead>
          <tbody>
            <tr v-for="vehicle in filteredVehicles" :key="vehicle.id" :class="{ 'tr-aus': getStatus(vehicle) === 'aus' }">
              <td>
                <div class="fzc"><VehicleChip :vehicle="vehicle" :subtitle="subtitle(vehicle)" /></div>
              </td>
              <td>
                <div class="stack-s" style="gap: 4px; align-items: flex-start">
                  <StatusBadge :status="getStatus(vehicle)" />
                  <span class="xs muted">{{ statusDetail(vehicle) }}</span>
                </div>
              </td>
              <td><Odometer :km="vehicle.mileage" class="zw-q" /></td>
              <td>
                <span v-if="getStatus(vehicle) === 'aus'" class="ok-t"><span class="mk mk-aus" aria-hidden="true" />ruht</span>
                <span v-else-if="!dueAppointments(vehicle.id).length" class="ok-t"><AppIcon name="check" />alle in Ordnung</span>
                <div v-else class="pk-list">
                  <InspectionBadge v-for="appointment in dueAppointments(vehicle.id)" :key="appointment.id" :appointment="appointment" />
                </div>
              </td>
              <td class="r">
                <NuxtLink class="lnk" :to="`/admin/fahrzeuge/${vehicle.id}`" :aria-label="`Details zu ${vehicle.plate}`"><AppIcon name="chevronRight" /></NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="fz-grid">
        <NuxtLink v-for="vehicle in filteredVehicles" :key="vehicle.id" class="fz" :class="{ 'fz-aus': getStatus(vehicle) === 'aus' }" :to="`/admin/fahrzeuge/${vehicle.id}`">
          <div class="fz-face">
            <StatusBadge :status="getStatus(vehicle)" />
            <VehicleIcon :type="vehicle.type" class="fzi-m" />
          </div>
          <div class="fz-b">
            <h3>{{ vehicle.name }}</h3>
            <span class="sub">{{ subtitle(vehicle) }}</span>
            <Odometer :km="vehicle.mileage" />
            <StatusBadge v-if="getStatus(vehicle) === 'aus'" status="aus" label="Fristen ruhen" />
            <span v-else-if="!dueAppointments(vehicle.id).length" class="tm"><span class="mk mk-ok" aria-hidden="true" />Termine in Ordnung</span>
            <template v-else>
              <StatusBadge
                v-for="appointment in dueAppointments(vehicle.id)" :key="appointment.id"
                :status="getAppointmentStatus(appointment)"
                :label="`${getAppointmentShortName(appointment.type)} ${getAppointmentStatus(appointment) === 'ueber' ? 'überfällig' : `fällig ${formatAppointmentDate(appointment)}`}`"
              />
            </template>
          </div>
        </NuxtLink>
      </div>
    </section>
  </main>
</template>
