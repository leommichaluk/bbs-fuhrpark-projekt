<script setup lang="ts">
definePageMeta({ layout: false })

const { db } = useFleet()
const email = ref('')
const password = ref('')
const attemptsLeft = ref(3)
const hasError = ref(false)

// ponytail: mock login – any active mock address, any password
const login = () => {
  const user = db.value.profiles.find(p => p.active && p.email === email.value.trim().toLowerCase())
  if (user && password.value) return navigateTo(user.role === 'admin' ? '/admin' : '/')
  hasError.value = true
  attemptsLeft.value = Math.max(0, attemptsLeft.value - 1)
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
          <p style="color: #C9D3E0; font-size: 15px">{{ db.vehicles.length }} Fahrzeuge der SensorTec Automation GmbH, Osnabrück.</p>
        </div>
      </div>
      <div class="login-r">
        <div class="stack-s">
          <h1 style="font-size: 36px">Anmelden</h1>
          <p class="muted">Mit Ihrer dienstlichen E-Mail-Adresse.</p>
        </div>
        <div v-if="hasError" class="meld meld-err" role="alert">
          <AppIcon name="error" />
          <span><strong>Anmeldung fehlgeschlagen</strong>E-Mail-Adresse oder Passwort ist nicht korrekt. Bitte prüfen Sie Ihre Eingaben.</span>
        </div>
        <form class="stack" style="gap: 20px" @submit.prevent="login">
          <div class="feld" :class="{ err: hasError }">
            <label for="email">E-Mail-Adresse</label>
            <input id="email" v-model="email" class="inp" type="email" required autocomplete="username" :aria-invalid="hasError" aria-describedby="login-error">
          </div>
          <div class="feld" :class="{ err: hasError }">
            <div class="row-sb">
              <label for="password" class="lbl">Passwort</label>
              <a href="#" class="sm" style="font-weight: 500">Passwort vergessen?</a>
            </div>
            <input id="password" v-model="password" class="inp" type="password" required autocomplete="current-password" :aria-invalid="hasError" aria-describedby="login-error">
            <span v-if="hasError" id="login-error" class="ferr"><AppIcon name="error" />Noch {{ attemptsLeft }} Versuche, danach wird der Zugang für 15 Minuten gesperrt.</span>
          </div>
          <button class="btn btn-p btn-w" style="min-height: 52px; font-size: 16px" :disabled="!attemptsLeft">Anmelden</button>
        </form>
        <p class="hin"><AppIcon name="info" />Noch keinen Zugang? Die Logistik legt ihn für Sie an.</p>
      </div>
    </div>
  </div>
</template>
