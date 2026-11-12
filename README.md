# BBS Fuhrpark

Fuhrparkverwaltung für die SensorTec Automation GmbH: Fahrzeuge buchen, übernehmen und zurückgeben (Mitarbeiter), Fahrzeuge, Wartung und Zugänge verwalten (Logistik/Admin).

Nuxt 4 + Supabase (Datenbank und Login).

## Voraussetzungen

- **Node.js 22.21+ oder 24.11+** (Node 20 wird nicht unterstützt) – https://nodejs.org (LTS). Mit nvm: `nvm use` (liest `.nvmrc`).
- **Git**
- Zugang zum Supabase-Projekt (Dashboard)

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
NUXT_PUBLIC_SUPABASE_KEY=<publishable key>
```

Die Werte stehen im Supabase-Dashboard unter **Project Settings → API**. Nur den öffentlichen (publishable) Key eintragen, nie den Secret/Service-Key.

| | Befehl |
|---|---|
| **Mac** (Terminal) | `touch .env && open -e .env` |
| **Windows** (PowerShell) | `ni .env; notepad .env` |

> Windows: Beim Speichern im Editor darauf achten, dass die Datei `.env` heißt und nicht `.env.txt`.

### 4. Datenbank einrichten (nur einmal pro Supabase-Projekt)

Ist die Datenbank schon eingerichtet, diesen Schritt überspringen.

Im Supabase-Dashboard → **SQL Editor** nacheinander ausführen:

1. `migration.md` – Tabellen, Funktionen, Zugriffsregeln (RLS)
2. alle Dateien in `supabase/migrations/` in Namensreihenfolge
3. `supabase/seed/01_admin.sql` – legt den ersten Admin an. **Vorher** im Editor das Passwort bei `admin_password` eintragen (nicht committen!).
4. optional `supabase/seed/02_demo_data.sql` – Demo-Daten aus dem UI-Design (14 Fahrzeuge, Buchungen, Fahrtenbuch, 7 Testzugänge). Vorher `demo_password` setzen. Nur für Test-/Entwicklungsdatenbanken.

### 5. Starten

```bash
npm run dev
```

→ http://localhost:3000, Anmeldung mit `k.albers@sensortec-automation.de` und dem Passwort aus Schritt 4.

Admins landen auf `/admin`, Mitarbeiter auf `/`. Mit Demo-Daten eignet sich `t.wessels@sensortec-automation.de` zum Testen der Mitarbeiter-Seiten.

## Zugänge verwalten

- **Neuer Zugang:** Supabase-Dashboard → **Authentication → Users → Add user** (Einladung per E-Mail oder mit Passwort). Der Zugang erscheint danach in der App unter **Benutzer** als Mitarbeiter.
- **Admin machen, deaktivieren:** in der App unter **Benutzer** (`/admin/benutzer`).
- Deaktivierte Zugänge werden beim nächsten Seitenwechsel abgemeldet.

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktions-Build |
| `npm run preview` | Build lokal testen |
| `npm run lint` | Code prüfen (oxlint) |
| `npm test` | Tests der Geschäftslogik (Überschneidung, Kennzeichen, Fristen, Zeitumrechnung) |

## Datenbank ändern

Schemaänderungen kommen als neue Datei `supabase/migrations/<JJJJMMTTHHMMSS>_<beschreibung>.sql` ins Repo und werden im SQL Editor ausgeführt. Bereits ausgeführte Dateien nicht mehr ändern.

## Struktur

```
app/
  pages/        Routen (Datei = URL), Admin-Bereich unter pages/admin/
  components/   Vue-Komponenten (auto-import)
  composables/  useFleet: Daten aus Supabase laden und speichern
  middleware/   auth.global.ts: Login-Pflicht, Admin-Schutz, Daten neu laden
  utils/        fleet.ts: Typen, Umrechnung DB ↔ App, Prüfregeln, Formatierung
  assets/css/   main.css: Designsystem aus dem UI-Entwurf
supabase/
  migrations/   Schemaänderungen nach migration.md
  seed/         erster Admin, optionale Demo-Daten
test/           Tests (node --test)
migration.md    Grundschema mit Zugriffsregeln
```

## Probleme

- **`Unsupported Node.js version`** → Node auf 22/24 LTS aktualisieren.
- **Jede Seite leitet auf `/anmeldung`** → nicht angemeldet oder Sitzung abgelaufen; neu anmelden.
- **„Ihr Zugang ist deaktiviert“** → in `/admin/benutzer` (als Admin) wieder aktivieren.
- **Listen sind leer** → Datenbank noch nicht eingerichtet (Schritt 4) oder keine passende Zugriffsregel (RLS). Ohne Anmeldung liefert jede Tabelle absichtlich `[]`.
- **IDE meldet `Cannot find module '~/…'`** → `npx nuxi prepare`, dann TypeScript-Server neu starten.
- **Windows: `npm` nicht gefunden** → Terminal nach der Node-Installation neu öffnen.
