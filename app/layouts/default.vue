<script setup lang="ts">
const route = useRoute()
const supabase = useSupabaseClient()
const profile = useState('profile')
const isAdmin = computed(() => route.path.startsWith('/admin'))
// Booking and pickup/return are step flows: on phones they hide the bottom nav and pin their main button instead
const isFlowPage = computed(() => /^\/(buchen|fahrt\/)/.test(route.path))

const logout = async () => {
  await supabase.auth.signOut()
  profile.value = null
  await navigateTo('/anmeldung')
}

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
          <button type="button" @click="logout"><AppIcon name="logout" class="i" />Abmelden</button>
        </div>
      </nav>
      <slot />
    </div>
    <!-- Phone navigation (≤ 640 px), replaces the sidebar -->
    <nav v-if="!isFlowPage" class="mob-nav" aria-label="Hauptnavigation">
      <NuxtLink v-for="item in NAV_ITEMS[isAdmin ? 'admin' : 'employee']" :key="item.to" :to="item.to" :aria-current="item.activePattern.test(route.path) ? 'page' : undefined">
        <span class="ic"><AppIcon :name="item.icon" /></span>{{ item.label }}
      </NuxtLink>
      <button type="button" @click="logout"><span class="ic"><AppIcon name="logout" /></span>Abmelden</button>
    </nav>
  </div>
</template>
