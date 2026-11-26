<script setup lang="ts">
import type { Profile } from '~/utils/fleet'

const { supabase, db, write, isSaving, currentUser } = useFleet()
const confirmDialog = useTemplateRef('confirmDialog')
const search = ref('')
const roleFilter = ref<Profile['role'] | ''>('')
const filteredUsers = computed(() => db.value.profiles.filter(p =>
  (!roleFilter.value || p.role === roleFilter.value) && matches(`${p.name} ${p.email}`, search.value)))

const saveError = ref('')
const updateProfile = async (user: Profile, columns: { aktiv?: boolean, rolle?: Profile['role'] }) => {
  saveError.value = await write(() => supabase.from('profiles').update(columns).eq('id', user.id))
}
// Role changes and deactivation change what someone may do, so they are confirmed first; activating is not
const toggleRole = async (user: Profile) => {
  const toAdmin = user.role !== 'admin'
  if (await confirmDialog.value!.ask({
    title: toAdmin ? `${user.name} zum Admin machen?` : `${user.name} zum Mitarbeiter machen?`,
    text: toAdmin
      ? 'Admins sehen alle Fahrten und Namen und können Fahrzeuge, Wartung und Zugänge verwalten.'
      : 'Der Zugang verliert die Verwaltung und sieht danach nur noch eigene Fahrten.',
    confirmLabel: toAdmin ? 'Zum Admin machen' : 'Zum Mitarbeiter machen',
  })) await updateProfile(user, { rolle: toAdmin ? 'admin' : 'mitarbeiter' })
}
const toggleActive = async (user: Profile) => {
  if (user.active && !await confirmDialog.value!.ask({
    title: `${user.name} deaktivieren?`,
    text: 'Die Person kann sich danach nicht mehr anmelden und wird beim nächsten Seitenwechsel abgemeldet. Ihre Buchungen bleiben bestehen.',
    confirmLabel: 'Deaktivieren',
    danger: true,
  })) return
  await updateProfile(user, { aktiv: !user.active })
}
</script>

<template>
  <main class="main">
    <PageHeader title="Benutzer">
      <SearchField v-model="search" label="Benutzer suchen" placeholder="Name oder E-Mail suchen" />
    </PageHeader>

    <div v-if="saveError" class="meld meld-err" role="alert">
      <AppIcon name="error" />
      <span><strong>Speichern fehlgeschlagen</strong>{{ saveError }}</span>
    </div>

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
                <td class="r">
                  <span v-if="user.id === currentUser.id" class="xs muted">Ihr Zugang</span>
                  <template v-else>
                    <button type="button" class="btn btn-g btn-sm" :disabled="isSaving" @click="toggleRole(user)">{{ user.role === 'admin' ? 'Zum Mitarbeiter' : 'Zum Admin' }}</button>
                    <button type="button" class="btn btn-g btn-sm" :disabled="isSaving" @click="toggleActive(user)">{{ user.active ? 'Deaktivieren' : 'Aktivieren' }}</button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <aside class="card stack" aria-labelledby="new-user-heading">
        <h2 id="new-user-heading" style="font-size: 22px">Zugang anlegen</h2>
        <p class="sm">Neue Zugänge legen Sie vorerst im Supabase-Dashboard an:</p>
        <ol class="sm" style="margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px">
          <li>Authentication → Users → <strong>Add user</strong> (Einladung per E-Mail oder mit Passwort).</li>
          <li>Der Zugang erscheint danach hier als Mitarbeiter.</li>
          <li>Bei Bedarf hier <strong>Zum Admin</strong> wählen.</li>
        </ol>
        <p class="hin"><AppIcon name="info" />Name und Abteilung kommen aus den Metadaten (<code>name</code>) bzw. werden später ergänzt.</p>
      </aside>
    </div>
    <ConfirmDialog ref="confirmDialog" />
  </main>
</template>
