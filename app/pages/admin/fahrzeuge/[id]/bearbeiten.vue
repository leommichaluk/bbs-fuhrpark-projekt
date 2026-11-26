<script setup lang="ts">
import type { Appointment, VehicleType } from '~/utils/fleet'

const { supabase, db, write, findVehicle, userName, flashMessage } = useFleet()
const route = useRoute()
const vehicleId = route.params.id as string
const existingVehicle = findVehicle(vehicleId)
if (vehicleId !== 'neu' && !existingVehicle) throw createError({ statusCode: 404, statusMessage: 'Fahrzeug nicht gefunden' })

const findOpenAppointment = (type: Appointment['type']) => db.value.appointments.find(a => a.vehicleId === vehicleId && a.type === type && !a.done)
const form = reactive({
  plate: existingVehicle?.plate ?? '',
  manufacturer: existingVehicle?.manufacturer ?? '',
  model: existingVehicle?.model ?? '',
  buildYear: existingVehicle?.buildYear ?? new Date().getFullYear(),
  type: existingVehicle?.type ?? 'Kombi' as VehicleType,
  isPool: existingVehicle?.pool ?? false,
  mileage: existingVehicle?.mileage ?? null,
  nextInspectionMonth: findOpenAppointment('Hauptuntersuchung')?.dueDate.slice(0, 7) ?? '',
  nextServiceDate: findOpenAppointment('Inspektion')?.dueDate ?? '',
})
const saveError = ref('')

const lastMileage = existingVehicle?.mileage ?? 0
const lastReturnedTrip = db.value.trips
  .filter(t => t.vehicleId === vehicleId && t.returnMileage)
  .sort((a, b) => b.returnTime!.localeCompare(a.returnTime!))[0]
const plateError = computed(() => getPlateError(form.plate, db.value.vehicles.filter(v => v.id !== vehicleId).map(v => v.plate)))
const mileageTooLow = computed(() => form.mileage !== null && form.mileage < lastMileage)
const errorCount = computed(() => (plateError.value ? 1 : 0) + (mileageTooLow.value || form.mileage === null ? 1 : 0))
const isComplete = computed(() => !!form.manufacturer.trim() && !!form.model.trim() && !!form.buildYear)

const save = async () => {
  if (errorCount.value || !isComplete.value) return
  const columns = {
    kennzeichen: normalizePlate(form.plate),
    hersteller: form.manufacturer.trim(),
    modell: form.model.trim(),
    baujahr: form.buildYear,
    typ: form.type,
    pool: form.isPool,
    kilometerstand: form.mileage,
  }
  const { data, error } = existingVehicle
    ? await supabase.from('fahrzeuge').update(columns).eq('id', vehicleId).select('id').single()
    : await supabase.from('fahrzeuge').insert(columns).select('id').single()
  if (error) return (saveError.value = toUserMessage(error))

  // Deadlines are kept as open appointments
  const deadlines = [['Hauptuntersuchung', form.nextInspectionMonth && `${form.nextInspectionMonth}-01`], ['Inspektion', form.nextServiceDate]] as const
  saveError.value = await write(...deadlines.filter(([, dueDate]) => dueDate).map(([type, dueDate]) => () => {
    const openAppointment = findOpenAppointment(type)
    return openAppointment
      ? supabase.from('termine').update({ faellig_am: dueDate }).eq('id', openAppointment.id)
      : supabase.from('termine').insert({ fahrzeug_id: data.id, art: type, faellig_am: dueDate })
  }))
  if (saveError.value) return
  flashMessage.value = { title: 'Gespeichert', text: 'Die Änderungen sind übernommen.' }
  await navigateTo(`/admin/fahrzeuge/${data.id}`)
}
</script>

<template>
  <main class="main">
    <PageHeader
      :title="existingVehicle ? 'Fahrzeug bearbeiten' : 'Fahrzeug anlegen'"
      :back-to="existingVehicle ? `/admin/fahrzeuge/${vehicleId}` : '/admin'"
      :back-label="existingVehicle?.plate ?? 'Fahrzeuge'"
    />

    <div class="g-main">
      <form class="card form" novalidate @submit.prevent="save">
        <div v-if="saveError" class="meld meld-err" role="alert">
          <AppIcon name="error" />
          <span><strong>Speichern fehlgeschlagen</strong>{{ saveError }}</span>
        </div>
        <div v-else-if="errorCount && (form.plate || form.mileage)" class="meld meld-err" role="alert">
          <AppIcon name="error" />
          <span><strong>Bitte {{ errorCount }} Angabe{{ errorCount > 1 ? 'n' : '' }} prüfen</strong>Die markierten Felder werden beim Tippen geprüft.</span>
        </div>

        <fieldset class="fs">
          <legend><b>1</b>Fahrzeug</legend>
          <div class="feld" :class="form.plate ? (plateError ? 'err' : 'ok') : ''">
            <label for="plate">Kennzeichen</label>
            <input id="plate" v-model="form.plate" class="inp" style="font-family: var(--f-head); font-size: 18px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase" :aria-invalid="!!plateError" aria-describedby="plate-message">
            <span v-if="form.plate && plateError" id="plate-message" class="ferr"><AppIcon name="error" />{{ plateError }}</span>
            <span v-else-if="form.plate" id="plate-message" class="fok"><AppIcon name="check" />Kennzeichen ist frei.</span>
          </div>
          <div class="f2">
            <div class="feld">
              <label for="manufacturer">Hersteller</label>
              <input id="manufacturer" v-model="form.manufacturer" class="inp" required>
            </div>
            <div class="feld">
              <label for="model">Modell</label>
              <input id="model" v-model="form.model" class="inp" required>
            </div>
          </div>
          <div class="feld">
            <label for="build-year">Baujahr</label>
            <input id="build-year" v-model.number="form.buildYear" class="inp num" type="number" min="1950" max="2100" required style="max-width: 160px">
          </div>
          <div class="f2">
            <div class="feld">
              <label for="type">Größe</label>
              <select id="type" v-model="form.type" class="inp"><option v-for="type in VEHICLE_TYPES" :key="type">{{ type }}</option></select>
            </div>
            <div class="feld">
              <span id="usage-label" class="lbl">Nutzung</span>
              <div class="row" role="radiogroup" aria-labelledby="usage-label" style="gap: 20px">
                <label class="radio"><input v-model="form.isPool" type="radio" :value="false">Dienstwagen</label>
                <label class="radio"><input v-model="form.isPool" type="radio" :value="true">Poolfahrzeug</label>
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset class="fs">
          <legend><b>2</b>Kilometerstand</legend>
          <MileageInput
            v-model="form.mileage" label="Aktueller Kilometerstand" :min="lastMileage"
            :hint="existingVehicle && form.mileage !== null ? `${formatKm(form.mileage - lastMileage)} km seit der letzten Erfassung.` : ''"
          />
        </fieldset>

        <fieldset class="fs">
          <legend><b>3</b>Fristen</legend>
          <div class="f2">
            <div class="feld">
              <label for="next-inspection">Nächste HU (Monat/Jahr)</label>
              <input id="next-inspection" v-model="form.nextInspectionMonth" class="inp num" type="month">
            </div>
            <div class="feld">
              <label for="next-service">Nächste Inspektion</label>
              <input id="next-service" v-model="form.nextServiceDate" class="inp num" type="date">
            </div>
          </div>
          <p class="hin"><AppIcon name="info" />30 Tage vor einer Frist wird das Fahrzeug als „fällig“ markiert.</p>
        </fieldset>

        <div class="form-foot">
          <button class="btn btn-p" :disabled="!!errorCount || !isComplete">{{ existingVehicle ? 'Änderungen speichern' : 'Fahrzeug anlegen' }}</button>
          <NuxtLink class="btn btn-g" :to="existingVehicle ? `/admin/fahrzeuge/${vehicleId}` : '/admin'">Abbrechen</NuxtLink>
        </div>
      </form>

      <aside class="stack" aria-label="Vorschau">
        <div class="card stack">
          <h2 style="font-size: 22px">Vorschau</h2>
          <div class="vorschau" style="gap: 14px">
            <VehicleIcon :type="form.type" style="width: 240px; height: 112px; max-width: 100%" />
            <span class="stack-s" style="align-items: center; gap: 6px">
              <strong style="font-size: 18px">{{ `${form.manufacturer} ${form.model}`.trim() || 'Modell' }}</strong>
              <span class="kzt" style="font-size: 17px; height: 30px">{{ normalizePlate(form.plate) || 'OS-ST' }}</span>
            </span>
          </div>
          <div class="row-sb"><span class="sm muted">Kilometerstand</span><Odometer :km="form.mileage ?? 0" class="zw-q" /></div>
        </div>
        <div v-if="lastReturnedTrip" class="card-flat stack-s">
          <strong>Zuletzt erfasst</strong>
          <p class="sm muted">{{ formatKm(lastReturnedTrip.returnMileage!) }} km am {{ formatDate(lastReturnedTrip.returnTime!) }} bei der Rückgabe durch {{ userName(lastReturnedTrip.userId) }}.</p>
        </div>
      </aside>
    </div>
  </main>
</template>
