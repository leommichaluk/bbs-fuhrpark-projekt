<script setup lang="ts">
defineProps<{ title: string, backTo?: string, backLabel?: string }>()

const { currentUser, flashMessage } = useFleet()
// Show the message of the previous action once, then discard it
const message = flashMessage.value
flashMessage.value = null
</script>

<template>
  <header class="top">
    <div v-if="backTo" style="display: flex; flex-direction: column; gap: 4px; margin-right: auto">
      <NuxtLink class="zurueck" :to="backTo"><AppIcon name="chevronLeft" class="i" style="width: 16px; height: 16px" />{{ backLabel }}</NuxtLink>
      <h1 style="font-size: 36px">{{ title }}</h1>
    </div>
    <h1 v-else>{{ title }}</h1>
    <slot />
    <div class="wer">
      <span class="avatar" :class="{ 'avatar-sky': currentUser.role !== 'admin' }" aria-hidden="true">{{ initials(currentUser.name) }}</span>
      <span class="n"><strong>{{ currentUser.name }}</strong><small>{{ currentUser.department }}</small></span>
    </div>
  </header>
  <div v-if="message" class="meld meld-ok" role="status">
    <AppIcon name="check" />
    <span><strong>{{ message.title }}</strong>{{ message.text }}</span>
  </div>
</template>
