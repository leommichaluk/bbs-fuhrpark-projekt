# BBS Fuhrpark

Nuxt 4 + Supabase.

## Voraussetzungen

- **Node.js 22.21+ oder 24.11+** (Node 20 wird nicht unterstützt) – https://nodejs.org (LTS)
- **Git**

Version prüfen:

```bash
node -v
```

## Setup

### 1. Repo klonen

```bash
git clone <repo-url>
cd bbs-fuhrpark-projekt
```

### 2. Abhängigkeiten installieren

```bash
npm install
```

### 3. `.env` anlegen

Datei `.env` im Projektordner erstellen:

```
NUXT_PUBLIC_SUPABASE_URL=https://<projekt>.supabase.co
NUXT_PUBLIC_SUPABASE_KEY=<anon/publishable key>
```

Die Werte stehen im Supabase-Dashboard unter **Project Settings → API**.

| | Befehl |
|---|---|
| **Mac** (Terminal) | `touch .env && open -e .env` |
| **Windows** (PowerShell) | `ni .env; notepad .env` |

> Windows: Beim Speichern im Editor darauf achten, dass die Datei `.env` heißt und nicht `.env.txt`.

### 4. Starten

```bash
npm run dev
```

→ http://localhost:3000

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktions-Build |
| `npm run preview` | Build lokal testen |

## Supabase benutzen

```ts
const supabase = useSupabaseClient()
const { data } = await useAsyncData('fahrzeuge', async () => {
  const { data, error } = await supabase.from('fahrzeuge').select()
  if (error) throw error
  return data
})
```

Auth ist noch aus (`redirect: false` in `nuxt.config.ts`), alle Abfragen laufen als `anon`.
Bei aktivem RLS braucht jede Tabelle eine Policy, sonst kommt `[]` zurück:

```sql
create policy "anon read" on fahrzeuge for select to anon using (true);
```

## Struktur

```
app/
  pages/        Routen (Datei = URL)
  components/   Vue-Komponenten (auto-import)
  composables/  use*-Funktionen (auto-import)
  middleware/   Routen-Middleware
nuxt.config.ts  Konfiguration
```

## Probleme

- **`Unsupported Node.js version`** → Node auf 22/24 LTS aktualisieren.
- **Seite zeigt `[]`** → RLS-Policy fehlt oder Tabelle leer.
- **Windows: `npm` nicht gefunden** → Terminal nach der Node-Installation neu öffnen.
