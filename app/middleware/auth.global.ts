import type { Profile, ProfileRow } from '~/utils/fleet'

// Loads the signed-in user's profile once per session, signs out deactivated users, keeps non-admins out of /admin
// and reloads the fleet data on every navigation.
// The redirect for signed-out users is done by @nuxtjs/supabase (redirectOptions in nuxt.config.ts).
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/anmeldung') return
  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/anmeldung')

  const profile = useState<Profile | null>('profile', () => null)
  if (profile.value?.id !== user.value.sub) {
    const { data } = await useSupabaseClient().from('profiles').select(PROFILE_COLUMNS).eq('id', user.value.sub).single<ProfileRow>()
    profile.value = data && toProfile(data)
  }

  if (!profile.value?.active) {
    await useSupabaseClient().auth.signOut()
    profile.value = null
    return navigateTo({ path: '/anmeldung', query: { grund: 'deaktiviert' } })
  }
  if (to.path.startsWith('/admin') && profile.value.role !== 'admin') return navigateTo('/')

  await useFleet().reload()
})
