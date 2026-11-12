<script setup lang="ts">
import type { ProfileRow } from '~/utils/fleet'

definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const route = useRoute()
const email = ref('')
const password = ref('')
const isSubmitting = ref(false)
const errorMessage = ref(route.query.grund === 'deaktiviert' ? 'Ihr Zugang ist deaktiviert. Bitte wenden Sie sich an die Logistik.' : '')

const login = async () => {
  isSubmitting.value = true
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value })
  if (error) {
    isSubmitting.value = false
    errorMessage.value = error.status === 429
      ? 'Zu viele Anmeldeversuche. Bitte warten Sie einen Moment.'
      : 'E-Mail-Adresse oder Passwort ist nicht korrekt. Bitte prüfen Sie Ihre Eingaben.'
    return
  }
  const { data: profile } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', data.user.id).single<ProfileRow>()
  // Deactivated users are signed out again by middleware/auth.global.ts
  await navigateTo(profile?.rolle === 'admin' ? '/admin' : '/')
}
</script>

<template>
  <div class="screen" style="display: flex; align-items: center; justify-content: center; padding: 48px 24px">
    <div class="login">
      <div class="login-l">
        <div class="logo" style="padding: 0">
          <span class="logo-mark"><AppIcon name="car" /></span>
          <span class="logo-t">SensorTec<span>Fuhrpark</span></span>
        </div>
        <div style="margin-top: auto; display: flex; flex-direction: column; gap: 18px">
          <div style="background: var(--grund); border-radius: 22px; padding: 22px 26px; align-self: flex-start">
            <VehicleIcon type="Großraumtransporter" style="width: 280px; height: 131px; max-width: 100%" />
          </div>
          <p style="font-family: var(--f-head); font-size: 34px; font-weight: 600; line-height: 1.15">Fahrzeuge buchen, übernehmen und zurückgeben.</p>
          <p style="color: #C9D3E0; font-size: 15px">Fuhrpark der SensorTec Automation GmbH, Osnabrück.</p>
        </div>
      </div>
      <div class="login-r">
        <div class="stack-s">
          <h1 style="font-size: 36px">Anmelden</h1>
          <p class="muted">Mit Ihrer dienstlichen E-Mail-Adresse.</p>
        </div>
        <div v-if="errorMessage" id="login-error" class="meld meld-err" role="alert">
          <AppIcon name="error" />
          <span><strong>Anmeldung fehlgeschlagen</strong>{{ errorMessage }}</span>
        </div>
        <form class="stack" style="gap: 20px" @submit.prevent="login">
          <div class="feld" :class="{ err: errorMessage }">
            <label for="email">E-Mail-Adresse</label>
            <input id="email" v-model="email" class="inp" type="email" required autocomplete="username" :aria-invalid="!!errorMessage" aria-describedby="login-error">
          </div>
          <div class="feld" :class="{ err: errorMessage }">
            <label for="password">Passwort</label>
            <input id="password" v-model="password" class="inp" type="password" required autocomplete="current-password" :aria-invalid="!!errorMessage" aria-describedby="login-error">
          </div>
          <button class="btn btn-p btn-w" style="min-height: 52px; font-size: 16px" :disabled="isSubmitting">{{ isSubmitting ? 'Anmelden …' : 'Anmelden' }}</button>
        </form>
        <p class="hin"><AppIcon name="info" />Noch keinen Zugang oder Passwort vergessen? Die Logistik hilft Ihnen weiter.</p>
      </div>
    </div>
  </div>
</template>
