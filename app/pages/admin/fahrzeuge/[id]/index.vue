<script setup lang="ts">
const { supabase, db, write, findVehicle, userName, flashMessage, runningBooking, activeBookings } = useFleet()
const route = useRoute()
const vehicle = computed(() => findVehicle(route.params.id as string))
if (!vehicle.value) throw createError({ statusCode: 404, statusMessage: 'Fahrzeug nicht gefunden' })

const TABS = ['Termine', 'Historie', 'Buchungen', 'Fahrtenbuch', 'Tankkarte', 'Stammdaten'] as const
const activeTab = ref<typeof TABS[number]>('Termine')

const activeBooking = computed(() => runningBooking(vehicle.value!.id))
const heroDetail = computed(() => activeBooking.value
  ? `${userName(activeBooking.value.userId)} · ${formatDay(activeBooking.value.until)} bis ${formatTime(activeBooking.value.until)} Uhr`
  : vehicle.value!.statusNote)
const appointments = computed(() => db.value.appointments.filter(a => a.vehicleId === vehicle.value!.id && !a.done).sort((a, b) => a.dueDate.localeCompare(b.dueDate)))
const maintenanceHistory = computed(() => db.value.maintenanceRecords.filter(m => m.vehicleId === vehicle.value!.id).sort((a, b) => b.date.localeCompare(a.date)))
const openBookings = computed(() => activeBookings(vehicle.value!.id))
const trips = computed(() => db.value.trips.filter(t => t.vehicleId === vehicle.value!.id).sort((a, b) => b.pickupTime.localeCompare(a.pickupTime)))
const lastTrip = computed(() => trips.value[0])

// Take out of service
const decommissionDialog = ref<HTMLDialogElement>()
const decommissionDate = ref(currentLocalTime().slice(0, 10))
const decommissionReason = ref('Verkauf geplant')
const affectedBookings = computed(() => openBookings.value.filter(b => b.status === 'gebucht' && b.from >= decommissionDate.value))
const saveError = ref('')
const decommission = async () => {
  const affectedIds = affectedBookings.value.map(b => b.id)
  saveError.value = await write(
    () => supabase.from('buchungen').update({ status: 'storniert' }).in('id', affectedIds),
    () => supabase.from('fahrzeuge').update({
      status: 'ausser_betrieb',
      status_notiz: `seit ${formatDate(decommissionDate.value)} · ${decommissionReason.value}`,
    }).eq('id', vehicle.value!.id),
  )
  decommissionDialog.value!.close()
  if (saveError.value) return
  flashMessage.value = { title: 'Außer Betrieb genommen', text: `${vehicle.value!.name} kann nicht mehr gebucht werden.` }
  await navigateTo('/admin')
}
const recommission = async () => {
  saveError.value = await write(() => supabase.from('fahrzeuge').update({ status: 'verfuegbar', status_notiz: null }).eq('id', vehicle.value!.id))
}
</script>

<template>
  <main v-if="vehicle" class="main">
    <PageHeader title="Fahrzeug-Detail" back-to="/admin" back-label="Fahrzeuge" />

    <div v-if="saveError" class="meld meld-err" role="alert">
      <AppIcon name="error" />
      <span><strong>Speichern fehlgeschlagen</strong>{{ saveError }}</span>
    </div>

    <VehicleHero :vehicle="vehicle" :detail="heroDetail">
      <template #mileage>
        <span v-if="lastTrip" class="xs muted">zuletzt erfasst {{ formatDate(lastTrip.returnTime ?? lastTrip.pickupTime) }}</span>
      </template>
      <template #actions>
        <NuxtLink class="btn btn-s" :to="`/admin/fahrzeuge/${vehicle.id}/bearbeiten`">Bearbeiten</NuxtLink>
        <NuxtLink class="btn btn-s" :to="`/admin/wartung?fahrzeug=${vehicle.id}`">Wartung erfassen</NuxtLink>
        <span class="spacer" />
        <button v-if="vehicle.status === 'ausser_betrieb'" type="button" class="btn btn-s" @click="recommission">Wieder in Betrieb nehmen</button>
        <button v-else type="button" class="btn btn-rs" @click="decommissionDialog!.showModal()">Außer Betrieb nehmen</button>
      </template>
    </VehicleHero>

    <TabBar v-model="activeTab" :tabs="TABS" />

    <section class="card" role="tabpanel" :aria-label="activeTab">
      <template v-if="activeTab === 'Termine'">
        <div class="card-h"><h2>Termine</h2><NuxtLink class="btn btn-p btn-sm" :to="`/admin/wartung?fahrzeug=${vehicle.id}`">Termin erledigt erfassen</NuxtLink></div>
        <div v-if="vehicle.status === 'ausser_betrieb'" class="meld meld-info"><AppIcon name="info" /><span>Fristen ruhen, solange das Fahrzeug außer Betrieb ist.</span></div>
        <div v-else class="g3">
          <div v-for="appointment in appointments" :key="appointment.id" class="termin"><InspectionBadge :appointment="appointment" /></div>
          <p v-if="!appointments.length" class="muted">Keine Termine hinterlegt.</p>
        </div>
      </template>

      <template v-else-if="activeTab === 'Historie'">
        <div class="card-h"><h2>Historie</h2><NuxtLink class="btn btn-s btn-sm" :to="`/admin/wartung?fahrzeug=${vehicle.id}`">Eintrag erfassen</NuxtLink></div>
        <div class="hist sm muted b"><span>Datum</span><span>Art</span><span>km</span><span>Durchgeführt</span></div>
        <div v-for="entry in maintenanceHistory" :key="entry.id" class="hist">
          <span class="num">{{ formatDate(entry.date) }}</span>
          <StatusBadge :status="entry.type === 'Reparatur' ? 'werkstatt' : 'ok'" :label="entry.type" style="justify-self: start" />
          <span class="num">{{ formatKm(entry.mileage) }}</span>
          <span>{{ [entry.performedBy, entry.description].filter(Boolean).join(' · ') }}</span>
        </div>
        <p v-if="!maintenanceHistory.length" class="muted" style="padding-top: 14px">Noch keine Einträge.</p>
      </template>

      <template v-else-if="activeTab === 'Buchungen'">
        <div class="card-h"><h2>Buchungen</h2></div>
        <BookingRow v-for="booking in openBookings" :key="booking.id" :booking="booking">
          {{ userName(booking.userId) }} · {{ booking.purpose }}
        </BookingRow>
        <p v-if="!openBookings.length" class="muted">Keine offenen Buchungen.</p>
      </template>

      <template v-else-if="activeTab === 'Fahrtenbuch'">
        <div class="card-h"><h2>Fahrtenbuch</h2></div>
        <LogbookTable :trips="trips" column="driver" />
      </template>

      <template v-else-if="activeTab === 'Tankkarte'">
        <div class="card-h"><h2>Tankkarte</h2><NuxtLink class="btn btn-s btn-sm" :to="`/admin/fahrzeuge/${vehicle.id}/bearbeiten`">Ändern</NuxtLink></div>
        <dl v-if="vehicle.fuelCard" class="dl">
          <dt>Kartennummer</dt><dd class="num">•••• •••• {{ vehicle.fuelCard }}</dd>
          <dt>Status</dt><dd><StatusBadge status="ok" label="aktiv" /></dd>
        </dl>
        <p v-else class="muted">Keine Tankkarte hinterlegt.</p>
      </template>

      <template v-else>
        <div class="card-h"><h2>Stammdaten</h2><NuxtLink class="btn btn-s btn-sm" :to="`/admin/fahrzeuge/${vehicle.id}/bearbeiten`">Bearbeiten</NuxtLink></div>
        <dl class="dl">
          <dt>Kennzeichen</dt><dd><span class="kzt">{{ vehicle.plate }}</span></dd>
          <dt>Hersteller und Modell</dt><dd>{{ vehicle.name }}</dd>
          <dt>Größe</dt><dd>{{ vehicle.type }} · {{ vehicle.seats }} Sitze</dd>
          <dt>Nutzung</dt><dd>{{ vehicle.pool ? 'Poolfahrzeug' : 'Dienstwagen' }}</dd>
          <dt>Baujahr</dt><dd class="num">{{ vehicle.buildYear }}</dd>
          <dt>Kraftstoff</dt><dd>{{ vehicle.fuelType ?? '–' }}</dd>
        </dl>
      </template>
    </section>

    <dialog ref="decommissionDialog" class="dlg" aria-labelledby="decommission-heading" aria-describedby="decommission-text">
      <div class="row" style="gap: 16px; align-items: flex-start; flex-wrap: nowrap">
        <span class="dlg-icon"><span class="mk mk-aus" style="width: 22px; height: 22px; border-width: 2px" aria-hidden="true" /></span>
        <div class="stack-s">
          <h2 id="decommission-heading">{{ vehicle.name }} außer Betrieb nehmen?</h2>
          <span class="kzt" style="align-self: flex-start">{{ vehicle.plate }}</span>
          <p id="decommission-text" class="muted">Das Fahrzeug kann danach nicht mehr gebucht werden. Fristen ruhen, bis es wieder in Betrieb genommen wird.</p>
        </div>
      </div>
      <div v-if="affectedBookings.length" class="meld meld-warn">
        <AppIcon name="warning" />
        <span><strong>{{ affectedBookings.length }} künftige Buchung{{ affectedBookings.length > 1 ? 'en werden' : ' wird' }} storniert</strong>{{ affectedBookings.map(b => `${formatDay(b.from)} (${userName(b.userId)})`).join(', ') }}</span>
      </div>
      <form class="stack" style="gap: 20px" @submit.prevent="decommission">
        <div class="f2">
          <div class="feld">
            <label for="decommission-date">Außer Betrieb ab</label>
            <input id="decommission-date" v-model="decommissionDate" class="inp num" type="date" required>
          </div>
          <div class="feld">
            <label for="decommission-reason">Grund</label>
            <select id="decommission-reason" v-model="decommissionReason" class="inp"><option>Verkauf geplant</option><option>Technischer Defekt</option><option>Stilllegung</option><option>Sonstiges</option></select>
          </div>
        </div>
        <div class="dlg-foot">
          <button type="button" class="btn btn-s" @click="decommissionDialog!.close()">Abbrechen</button>
          <button class="btn btn-r">Außer Betrieb nehmen</button>
        </div>
      </form>
    </dialog>
  </main>
</template>
