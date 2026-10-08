export default defineNuxtConfig({
  compatibilityDate: '2026-10-08',
  devtools: { enabled: true },
  modules: ['@nuxtjs/supabase'],
  supabase: {
    redirect: false, // kein Auth vorerst – auf true setzen, sobald Login existiert
    types: false, // `npx supabase gen types` → app/types/database.types.ts, dann Option entfernen
  },
})
