<script setup lang="ts">
import type { Profile } from '~/utils/fleet'

const { db } = useFleet()
const search = ref('')
const roleFilter = ref<Profile['role'] | ''>('')
const filteredUsers = computed(() => db.value.profiles.filter(p =>
  (!roleFilter.value || p.role === roleFilter.value) && matches(`${p.name} ${p.email}`, search.value)))

const newUser = reactive({ name: '', email: '', role: 'mitarbeiter' as Profile['role'] })
const createdUserName = ref('')
const isEmailTaken = computed(() => db.value.profiles.some(p => p.email === newUser.email.trim().toLowerCase()))
const createUser = () => {
  if (isEmailTaken.value) return
  db.value.profiles.push({ id: crypto.randomUUID(), name: newUser.name.trim(), email: newUser.email.trim().toLowerCase(), role: newUser.role, active: true, department: '' })
  createdUserName.value = newUser.name
  Object.assign(newUser, { name: '', email: '', role: 'mitarbeiter' })
}
</script>

<template>
  <main class="main">
    <PageHeader title="Benutzer">
      <SearchField v-model="search" label="Benutzer suchen" placeholder="Name oder E-Mail suchen" />
    </PageHeader>

    <div class="g-main">
      <section class="card" aria-labelledby="users-heading">
        <div class="card-h">
          <h2 id="users-heading">{{ filteredUsers.length }} Zugänge</h2>
          <div class="seg" role="group" aria-label="Rolle filtern">
            <button type="button" :aria-pressed="roleFilter === ''" @click="roleFilter = ''">Alle</button>
            <button type="button" :aria-pressed="roleFilter === 'admin'" @click="roleFilter = 'admin'">Administratoren</button>
            <button type="button" :aria-pressed="roleFilter === 'mitarbeiter'" @click="roleFilter = 'mitarbeiter'">Mitarbeiter</button>
          </div>
        </div>
        <div class="tb-wrap">
          <table class="tb">
            <thead><tr><th scope="col">Name</th><th scope="col">Rolle</th><th scope="col">Status</th><th scope="col"><span class="vh">Aktion</span></th></tr></thead>
            <tbody>
              <tr v-for="user in filteredUsers" :key="user.id" :class="{ 'tr-aus': !user.active }">
                <td><div class="fzc"><span class="avatar avatar-s" aria-hidden="true">{{ initials(user.name) }}</span><span class="m"><strong>{{ user.name }}</strong><small>{{ user.email }}</small></span></div></td>
                <td><span class="rolle-t" :class="{ 'rolle-a': user.role === 'admin' }">{{ user.role === 'admin' ? 'Administrator' : 'Mitarbeiter' }}</span></td>
                <td><StatusBadge :status="user.active ? 'ok' : 'aus'" :label="user.active ? 'aktiv' : 'deaktiviert'" /></td>
                <td class="r"><button type="button" class="btn btn-g btn-sm" @click="user.active = !user.active">{{ user.active ? 'Deaktivieren' : 'Aktivieren' }}</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <aside class="card" aria-labelledby="new-user-heading">
        <form class="form" style="gap: 20px" @submit.prevent="createUser">
          <div class="stack-s"><h2 id="new-user-heading" style="font-size: 22px">Zugang anlegen</h2><p class="sm muted">Die Person erhält eine E-Mail, um ihr Passwort zu setzen.</p></div>
          <div v-if="createdUserName" class="meld meld-ok" role="status"><AppIcon name="check" /><span><strong>Zugang angelegt</strong>{{ createdUserName }} erhält eine E-Mail.</span></div>
          <div class="feld"><label for="new-user-name">Vor- und Nachname</label><input id="new-user-name" v-model="newUser.name" class="inp" required></div>
          <div class="feld" :class="{ err: isEmailTaken }">
            <label for="new-user-email">E-Mail-Adresse</label>
            <input id="new-user-email" v-model="newUser.email" class="inp" type="email" required :aria-invalid="isEmailTaken" aria-describedby="new-user-email-error">
            <span v-if="isEmailTaken" id="new-user-email-error" class="ferr"><AppIcon name="error" />Für diese Adresse gibt es bereits einen Zugang.</span>
          </div>
          <div class="feld">
            <span id="role-label" class="lbl">Rolle</span>
            <div role="radiogroup" aria-labelledby="role-label">
              <label class="radio"><input v-model="newUser.role" type="radio" value="mitarbeiter">Mitarbeiter</label>
              <label class="radio"><input v-model="newUser.role" type="radio" value="admin">Administrator / Logistik</label>
            </div>
          </div>
          <button class="btn btn-p btn-w" :disabled="isEmailTaken">Zugang anlegen</button>
        </form>
      </aside>
    </div>
  </main>
</template>
