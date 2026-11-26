import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  nitro: {
    externals: {
      inline: [/[\\/]node_modules[\\/]nuxt[\\/]dist[\\/]/]
    }
  },
  compatibilityDate: '2026-10-08',
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      title: 'SensorTec Fuhrpark',
      link: [{ rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap' }],
    },
  },
  modules: ['@nuxtjs/supabase'],
  css: ['~/assets/css/main.css'],
  typescript: {
    // test/ läuft direkt mit Node (Type-Stripping) und importiert daher mit .ts-Endung
    nodeTsConfig: { include: ['../test/**/*'], compilerOptions: { allowImportingTsExtensions: true, types: ['node'] } },
  },
  vite: { plugins: [tailwindcss()] },
  supabase: {
    // Nicht angemeldet → /anmeldung; Profil laden und Admin-Bereich schützen: app/middleware/auth.global.ts
    redirect: true,
    redirectOptions: { login: '/anmeldung', callback: '/anmeldung' },
    types: false, // `npx supabase gen types` → app/types/database.types.ts, dann Option entfernen
  },
})
