<script setup lang="ts">
// Mileage field: the user types "86.240" etc., the model is the parsed number (null while empty).
// Other attributes (required, style) go to the <input>.
defineOptions({ inheritAttrs: false })
const props = withDefaults(defineProps<{ label: string, min: number, minLabel?: string, hint?: string }>(), { minLabel: 'der zuletzt erfasste' })
const mileage = defineModel<number | null>({ required: true })

const text = ref(mileage.value === null ? '' : formatKm(mileage.value))
watch(text, (value) => { mileage.value = parseMileage(value) })
watch(mileage, (value) => {
  if (value !== parseMileage(text.value)) text.value = value === null ? '' : formatKm(value)
})
const isTooLow = computed(() => mileage.value !== null && mileage.value < props.min)
</script>

<template>
  <div class="feld" :class="isTooLow ? 'err' : mileage !== null ? 'ok' : ''">
    <label for="mileage">{{ label }}</label>
    <div class="einheit"><input id="mileage" v-model="text" class="inp num" inputmode="numeric" v-bind="$attrs" :aria-invalid="isTooLow" aria-describedby="mileage-message"><span>km</span></div>
    <span v-if="isTooLow" id="mileage-message" class="ferr"><AppIcon name="error" />Der Kilometerstand darf nicht kleiner sein als {{ minLabel }} ({{ formatKm(min) }} km).</span>
    <span v-else-if="hint" id="mileage-message" class="fok"><AppIcon name="check" />{{ hint }}</span>
  </div>
</template>
