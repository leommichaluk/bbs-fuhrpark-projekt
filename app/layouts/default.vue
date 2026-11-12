<script setup lang="ts">
const route = useRoute()
const isAdmin = computed(() => route.path.startsWith('/admin'))

const NAV_ITEMS = {
  admin: [
    { to: '/admin', icon: 'car', label: 'Fahrzeuge', activePattern: /^\/admin(\/fahrzeuge|\/?$)/ },
    { to: '/admin/wartung', icon: 'wrench', label: 'Wartung', activePattern: /^\/admin\/wartung/ },
    { to: '/admin/benutzer', icon: 'users', label: 'Benutzer', activePattern: /^\/admin\/benutzer/ },
  ],
  employee: [
    { to: '/', icon: 'home', label: 'Übersicht', activePattern: /^\/(fahrzeuge|fahrt|$)/ },
    { to: '/buchen', icon: 'calendarPlus', label: 'Buchen', activePattern: /^\/buchen/ },
    { to: '/buchungen', icon: 'book', label: 'Meine Buchungen', activePattern: /^\/buchungen/ },
  ],
} as const
</script>

<template>
  <div class="screen">
    <div class="app">
      <nav class="side" aria-label="Hauptnavigation">
        <NuxtLink class="logo" :to="isAdmin ? '/admin' : '/'">
          <span class="logo-mark"><AppIcon name="car" /></span>
          <span class="logo-t">SensorTec<span>Fuhrpark</span></span>
        </NuxtLink>
        <ul class="nav">
          <li v-for="item in NAV_ITEMS[isAdmin ? 'admin' : 'employee']" :key="item.to">
            <NuxtLink :to="item.to" :aria-current="item.activePattern.test(route.path) ? 'page' : undefined"><AppIcon :name="item.icon" />{{ item.label }}</NuxtLink>
          </li>
        </ul>
        <div class="side-foot">
          <span class="rolle">{{ isAdmin ? 'Administrator' : 'Mitarbeiter' }}</span>
          <NuxtLink to="/anmeldung"><AppIcon name="logout" class="i" />Abmelden</NuxtLink>
        </div>
      </nav>
      <slot />
    </div>
  </div>
</template>
