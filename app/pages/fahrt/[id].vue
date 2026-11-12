<script setup lang="ts">
// Pickup (step 1) and return (step 2) of one's own booking – like fahrzeug_uebernehmen/-zurueckgeben in migration.md
const { db, currentUser, findVehicle, flashMessage, dueAppointments } = useFleet()
const route = useRoute()
const booking = computed(() => db.value.bookings.find(b => b.id === route.params.id && b.userId === currentUser.value.id))
if (!booking.value || !['gebucht', 'uebernommen'].includes(booking.value.status)) throw createError({ statusCode: 404, statusMessage: 'Buchung nicht gefunden oder abgeschlossen' })

const vehicle = computed(() => findVehicle(booking.value!.vehicleId)!)
const trip = computed(() => db.value.trips.find(t => t.bookingId === booking.value!.id))
const isReturn = computed(() => booking.value!.status === 'uebernommen')
const openAppointments = computed(() => dueAppointments(vehicle.value.id))

const mileage = ref<number | null>(isReturn.value ? null : vehicle.value.mileage)
const purpose = ref(booking.value.purpose)
const fuelLevel = ref('¾')
const noteForLogistics = ref('')
const referenceMileage = computed(() => isReturn.value ? trip.value!.pickupMileage : vehicle.value.mileage)
const mileageTooLow = computed(() => mileage.value !== null && mileage.value < referenceMileage.value)
const distance = computed(() => mileage.value === null || mileageTooLow.value ? null : mileage.value - referenceMileage.value)
const pickupBlockedReason = computed(() =>
  isReturn.value ? ''
    : NOW < booking.value!.from ? `Übernahme erst ab ${formatDay(booking.value!.from)}, ${formatTime(booking.value!.from)} Uhr möglich.`
      : NOW > booking.value!.until ? 'Der Buchungszeitraum ist abgelaufen.'
        : vehicle.value.status !== 'verfuegbar' ? 'Das Fahrzeug ist nicht verfügbar.' : '')

const submit = () => {
  if (mileage.value === null || mileageTooLow.value || pickupBlockedReason.value) return
  if (isReturn.value) {
    Object.assign(trip.value!, { returnTime: NOW, returnMileage: mileage.value, fuelLevel: fuelLevel.value, note: noteForLogistics.value })
    booking.value!.status = 'zurueckgegeben'
    flashMessage.value = { title: 'Zurückgegeben', text: `${formatKm(distance.value!)} km wurden ins Fahrtenbuch übernommen.` }
  }
  else {
    db.value.trips.push({
      id: crypto.randomUUID(),
      bookingId: booking.value!.id,
      vehicleId: vehicle.value.id,
      userId: currentUser.value.id,
      pickupTime: NOW,
      pickupMileage: mileage.value,
      purpose: purpose.value.trim(),
    })
    booking.value!.status = 'uebernommen'
    flashMessage.value = { title: 'Übernommen', text: `Gute Fahrt mit ${vehicle.value.model}. Bitte bis ${formatUntil(booking.value!.until)} zurückgeben.` }
  }
  vehicle.value.mileage = mileage.value
  navigateTo('/buchungen')
}
</script>

<template>
  <main v-if="booking" class="main">
    <PageHeader :title="isReturn ? 'Fahrzeug zurückgeben' : 'Fahrzeug übernehmen'" back-to="/buchungen" back-label="Meine Buchungen" />

    <ol class="schritte" style="list-style: none; margin: 0; padding: 0; max-width: 640px">
      <li class="schritt" :class="isReturn ? 'done' : 'on'" :aria-current="isReturn ? undefined : 'step'">
        <b><AppIcon v-if="isReturn" name="check" /><template v-else>1</template></b>Übernahme{{ isReturn && trip ? ` · ${formatTime(trip.pickupTime)} Uhr` : '' }}
      </li>
      <li class="schritt" :class="{ on: isReturn }" :aria-current="isReturn ? 'step' : undefined"><b>2</b>Rückgabe</li>
    </ol>

    <div class="g-main">
      <form class="card form" style="padding: 28px" @submit.prevent="submit">
        <div v-if="pickupBlockedReason" class="meld meld-err" role="alert"><AppIcon name="error" /><span><strong>Übernahme nicht möglich</strong>{{ pickupBlockedReason }}</span></div>

        <fieldset class="fs">
          <legend><b>1</b>Kilometerstand</legend>
          <MileageInput
            v-model="mileage" :min="referenceMileage" required style="font-size: 20px; height: 56px"
            :label="`Kilometerstand bei ${isReturn ? 'Rückgabe' : 'Übernahme'}`"
            :min-label="isReturn ? 'bei der Übernahme' : 'der zuletzt erfasste'"
            :hint="!isReturn && mileage === referenceMileage ? 'Stimmt mit der letzten Rückgabe überein.' : ''"
          />
          <template v-if="isReturn">
            <div class="gef-box"><span class="b">Gefahren</span><Odometer :km="distance" :digit-count="4" :separator="false" class="zw-l" /></div>
            <p class="hin"><AppIcon name="info" />Wird automatisch berechnet und ins Fahrtenbuch übernommen.</p>
          </template>
        </fieldset>

        <fieldset v-if="isReturn" class="fs">
          <legend><b>2</b>Abschluss</legend>
          <div class="feld">
            <span id="fuel-label" class="lbl">Tankfüllung</span>
            <div class="seg" role="group" aria-labelledby="fuel-label" style="align-self: flex-start">
              <button v-for="level in ['leer', '¼', '½', '¾', 'voll']" :key="level" type="button" :aria-pressed="fuelLevel === level" @click="fuelLevel = level">{{ level }}</button>
            </div>
          </div>
          <div class="feld">
            <label for="note">Hinweis für die Logistik <span class="opt">(optional)</span></label>
            <textarea id="note" v-model="noteForLogistics" class="inp" style="height: 80px" />
          </div>
        </fieldset>
        <fieldset v-else class="fs">
          <legend><b>2</b>Zweck</legend>
          <div class="feld">
            <label for="purpose">Zweck der Fahrt</label>
            <input id="purpose" v-model="purpose" class="inp" required>
          </div>
        </fieldset>

        <button class="btn btn-p btn-w" style="min-height: 54px; font-size: 16px" :disabled="mileageTooLow || !!pickupBlockedReason">{{ isReturn ? 'Rückgabe abschließen' : 'Übernahme bestätigen' }}</button>
      </form>

      <aside class="card stack" aria-label="Fahrzeug">
        <div class="hero-bild"><VehicleIcon :type="vehicle.type" class="fzi-m" /></div>
        <div class="row-sb">
          <span class="stack-s" style="gap: 2px"><strong style="font-size: 18px">{{ vehicle.model }}</strong><span class="xs muted">{{ formatPeriod(booking.from, booking.until) }} Uhr</span></span>
          <span class="kzt">{{ vehicle.plate }}</span>
        </div>
        <div v-if="isReturn && trip" class="row-sb"><span class="xs muted b">ÜBERNAHME</span><Odometer :km="trip.pickupMileage" class="zw-q" /></div>
        <InspectionBadge v-for="appointment in openAppointments" :key="appointment.id" :appointment="appointment" />
      </aside>
    </div>
  </main>
</template>
