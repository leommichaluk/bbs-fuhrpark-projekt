<script setup lang="ts">
const supabase = useSupabaseClient()
const { data: fahrzeuge, error } = await useAsyncData('fahrzeuge', async () => {
  const { data, error } = await supabase.from('fahrzeuge').select()
  if (error) throw error
  return data
})
</script>

<template>
  <h1>Fahrzeuge</h1>
  <p v-if="error">Fehler: {{ error.message }}</p>
  <pre v-else>{{ fahrzeuge }}</pre>
</template>
