<script setup lang="ts" generic="Tab extends string">
defineProps<{ tabs: readonly Tab[] }>()
const activeTab = defineModel<Tab>({ required: true })
</script>

<template>
  <div class="reiter" role="tablist" aria-label="Fahrzeugdaten">
    <button v-for="tab in tabs" :key="tab" type="button" role="tab" :aria-selected="activeTab === tab" @click="activeTab = tab">{{ tab }}</button>
  </div>
</template>
