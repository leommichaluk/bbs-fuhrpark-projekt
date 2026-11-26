<script setup lang="ts">
import type { Appointment, Maintenance } from '~/utils/fleet'

const { supabase, db, write, findVehicle, flashMessage } = useFleet()
const route = useRoute()

// Maintenance type → the appointment it completes (null = no new deadline)
const MAINTENANCE_TYPES = { HU: 'Hauptuntersuchung', Inspektion: 'Inspektion', Wartung: null, Reparatur: null } as const
const activeVehicles = computed(() => db.value.vehicles.filter(v => v.status !== 'ausser_betrieb'))
const form = reactive({
  vehicleId: (route.query.fahrzeug as string) ?? activeVehicles.value[0]?.id ?? '',
  type: 'HU' as keyof typeof MAINTENANCE_TYPES,
  date: currentLocalTime().slice(0, 10),
  mileage: null as number | null,
  performedBy: '',
  description: '',
  nextDueDate: '',
})
const vehicle = computed(() => findVehicle(form.vehicleId)!)
const appointmentType = computed(() => MAINTENANCE_TYPES[form.type])
// Suggest the next deadline: HU in 2 years, Inspektion in 1 year
watchEffect(() => {
  const year = String(+form.date.slice(0, 4) + (form.type === 'HU' ? 2 : 1))
  form.nextDueDate = form.type === 'HU' ? `${year}-${form.date.slice(5, 7)}` : `${year}${form.date.slice(4)}`
})
watch(() => form.vehicleId, () => { form.mileage = vehicle.value?.mileage ?? null }, { immediate: true })

// Preview of the plaque the new deadline will get
const newAppointment = computed(() => appointmentType.value && {
  id: 'new', vehicleId: vehicle.value.id, type: appointmentType.value, done: false,
  dueDate: form.type === 'HU' ? `${form.nextDueDate}-01` : form.nextDueDate,
})
const mileageTooLow = computed(() => form.mileage !== null && form.mileage < vehicle.value.mileage)
const dueAppointments = computed(() => db.value.appointments
  .filter(a => !a.done && getAppointmentStatus(a) !== 'ok' && findVehicle(a.vehicleId)?.status !== 'ausser_betrieb')
  .sort((a, b) => a.dueDate.localeCompare(b.dueDate)))
// Short one-liner for the narrow side list, e.g. "HU überfällig seit 09/2026", "Inspektion fällig 28.10."
const dueText = (appointment: Appointment) => {
  const date = formatAppointmentDate(appointment)
  const name = appointment.type === 'Hauptuntersuchung' ? 'HU' : appointment.type
  const state = getAppointmentStatus(appointment) === 'ueber' ? 'überfällig seit' : 'fällig'
  return `${name} ${state} ${appointment.type === 'Inspektion' ? date.slice(0, 6) : date}`
}

const saveError = ref('')
const save = async () => {
  if (form.mileage === null || mileageTooLow.value) return
  const openAppointment = db.value.appointments.find(a => a.vehicleId === vehicle.value.id && a.type === appointmentType.value && !a.done)
  saveError.value = await write(
    () => supabase.from('wartungen').insert({
      fahrzeug_id: vehicle.value.id,
      art: form.type,
      datum: form.date,
      kilometerstand: form.mileage,
      durchgefuehrt_von: form.performedBy,
      beschreibung: form.description,
    }),
    // Mileage never decreases (DB trigger), so only raise it
    () => supabase.from('fahrzeuge').update({ kilometerstand: Math.max(form.mileage!, vehicle.value.mileage) }).eq('id', vehicle.value.id),
    ...(openAppointment ? [() => supabase.from('termine').update({ erledigt: true }).eq('id', openAppointment.id)] : []),
    ...(newAppointment.value
      ? [() => supabase.from('termine').insert({ fahrzeug_id: vehicle.value.id, art: newAppointment.value!.type, faellig_am: newAppointment.value!.dueDate })]
      : []),
  )
  if (saveError.value) return
  flashMessage.value = { title: 'Eintrag gespeichert', text: `${form.type} für ${vehicle.value.name} (${vehicle.value.plate}).` }
  await navigateTo(`/admin/fahrzeuge/${vehicle.value.id}`)
}
</script>

<template>
  <main class="main">
    <PageHeader title="Wartung erfassen" />

    <div class="g-main">
      <form class="card form" @submit.prevent="save">
        <div v-if="saveError" class="meld meld-err" role="alert">
          <AppIcon name="error" />
          <span><strong>Speichern fehlgeschlagen</strong>{{ saveError }}</span>
        </div>
        <fieldset class="fs">
          <legend><b>1</b>Fahrzeug und Art</legend>
          <div class="feld">
            <label for="vehicle">Fahrzeug</label>
            <select id="vehicle" v-model="form.vehicleId" class="inp">
              <option v-for="option in activeVehicles" :key="option.id" :value="option.id">{{ option.plate }} · {{ option.name }}</option>
            </select>
          </div>
          <div class="feld">
            <span id="type-label" class="lbl">Art</span>
            <div class="seg" role="group" aria-labelledby="type-label" style="align-self: flex-start">
              <button v-for="(_, type) in MAINTENANCE_TYPES" :key="type" type="button" :aria-pressed="form.type === type" @click="form.type = type">{{ type }}</button>
            </div>
          </div>
        </fieldset>

        <fieldset class="fs">
          <legend><b>2</b>Durchführung</legend>
          <div class="f2">
            <div class="feld">
              <label for="date">Datum</label>
              <input id="date" v-model="form.date" class="inp num" type="date" required>
            </div>
            <MileageInput v-model="form.mileage" label="Kilometerstand" :min="vehicle.mileage" required />
          </div>
          <div class="feld">
            <label for="performed-by">Durchgeführt von</label>
            <input id="performed-by" v-model="form.performedBy" class="inp" required>
          </div>
          <div class="feld">
            <label for="description">Beschreibung <span class="opt">(optional)</span></label>
            <textarea id="description" v-model="form.description" class="inp" />
          </div>
        </fieldset>

        <fieldset v-if="newAppointment" class="fs">
          <legend><b>3</b>Neue Frist</legend>
          <div class="f2">
            <div class="feld">
              <label for="next-due">{{ form.type === 'HU' ? 'Nächste HU (Monat/Jahr)' : 'Nächste Inspektion' }}</label>
              <input id="next-due" v-model="form.nextDueDate" class="inp num" :type="form.type === 'HU' ? 'month' : 'date'" required>
            </div>
            <div class="feld">
              <span class="lbl">Neue Prüfplakette</span>
              <InspectionBadge :appointment="newAppointment" />
            </div>
          </div>
        </fieldset>

        <div class="form-foot">
          <button class="btn btn-p" :disabled="mileageTooLow">Eintrag speichern</button>
          <NuxtLink class="btn btn-g" :to="`/admin/fahrzeuge/${form.vehicleId}`">Abbrechen</NuxtLink>
        </div>
      </form>

      <aside class="card" aria-labelledby="due-heading">
        <div class="card-h" style="margin-bottom: 6px"><h2 id="due-heading" style="font-size: 22px">Fällig und überfällig</h2></div>
        <div v-for="appointment in dueAppointments" :key="appointment.id" class="due">
          <InspectionBadge :appointment="appointment" compact />
          <span class="m">
            <strong>{{ findVehicle(appointment.vehicleId)?.name }} <span class="xs muted" style="font-weight: 400">{{ findVehicle(appointment.vehicleId)?.plate }}</span></strong>
            <span class="sm due-status" :style="{ color: getAppointmentStatus(appointment) === 'ueber' ? 'var(--rot-ink)' : 'var(--orange-ink)' }">
              <span :class="`mk mk-${getAppointmentStatus(appointment)}`" aria-hidden="true" />
              <span>{{ dueText(appointment) }}</span>
            </span>
          </span>
        </div>
        <p v-if="!dueAppointments.length" class="muted">Keine fälligen Termine.</p>
      </aside>
    </div>
  </main>
</template>
