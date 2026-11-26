# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Fleet management ("Fuhrparkverwaltung") for SensorTec Automation GmbH. Nuxt 4 + Supabase, Tailwind v4.

## Code conventions

- **Code identifiers in English and descriptive**: variables, functions, components, composables, types (`decommissionDialog`, `dateFrom`, `findOverlappingBooking`, `useFleet` — not `dlg`, `ab`, `ueberschneidung`).
- **Data fields and collections in English too** (`booking.purpose`, `vehicle.plate`, `appointment.dueDate`, `db.value.vehicles`), camelCase.
- **German stays German**: the SQL schema (`fahrzeuge.kennzeichen`, …; mapped to English fields in `app/utils/fleet.ts`), enum values (`gebucht`, `ausser_betrieb`, …), route paths (`/buchen`, `/admin/wartung`), all UI text, and the design's CSS class names/modifiers (`st-gebucht`, `mk-aus`, `.feld`, `.btn-p`).
- Arrow functions everywhere (`const save = () => {}`), `<script setup lang="ts">` in components.
- Commits: one meaningful line, no body, no `Co-Authored-By`/Claude attribution (also not in PRs) — the team needs clear ownership.
- Keep it minimal: no abstractions for a single use, prefer native HTML (`<dialog>`, `<input type="datetime-local|date|month">`, `required`) over libraries. Deliberate shortcuts with a known ceiling get a `// ponytail:` comment naming the upgrade path.

## Commands

Requires Node 22.21+ or 24.11+ (`.nvmrc`: 24). Node 20 is not supported.

```bash
npm install
npm run dev        # http://localhost:3000 (the .claude/launch.json "dev" config runs it on port 3001)
npm run build
npm run preview
npm run lint       # oxlint
npm run lint:fix
npm test           # node --test 'test/*.test.ts' (Node type stripping, no framework)
npx nuxi prepare && npx -p typescript@5.9 -p vue-tsc@3 vue-tsc -b --noEmit   # typecheck (vue-tsc is not a dependency)
```

Tests cover only pure logic in `app/utils/fleet.ts` and import it with the `.ts` extension, so that file must not use Nuxt auto-imports. Add one small test per new piece of non-trivial logic (validation, overlap, status rules).

TypeScript: the root `tsconfig.json` only references `.nuxt/tsconfig.*.json` (Nuxt 4 layout). If the IDE reports `Cannot find module '~/…'`, run `npx nuxi prepare` and restart the TS server. `test/` is added to the node tsconfig via `typescript.nodeTsConfig` in `nuxt.config.ts` (`allowImportingTsExtensions`, `@types/node`).

`.env` must contain `NUXT_PUBLIC_SUPABASE_URL` and `NUXT_PUBLIC_SUPABASE_KEY` (publishable key, from Supabase → Project Settings → API). No secret/service key is used anywhere.

## Architecture

- Nuxt 4 `app/` directory layout: file-based routes in `app/pages/`, auto-imported `components/`, `composables/`, `utils/`. One layout (`app/layouts/default.vue`, sidebar nav that switches between employee and admin items by route); `anmeldung.vue` uses `layout: false`. Each page's root element is `<main class="main">` and starts with `<PageHeader>`.
- Modules: only `@nuxtjs/supabase`. Tailwind v4 via `@tailwindcss/vite`, entry `app/assets/css/main.css`.
- Shared components (`app/components/`): `PageHeader` (title, back link, user, flash message), `AppIcon`, `VehicleIcon`, `VehicleHero`, `VehicleChip`, `StatusBadge`, `InspectionBadge`, `Odometer`, `MileageInput` (`v-model` is `number | null`, parses "86.240"), `LogbookTable`, `BookingRow`, `TabBar`, `SearchField`, `EmptyState`. Reuse them before writing markup.

### Routes

| Area | Route | Purpose |
|---|---|---|
| Employee | `/` | Overview: running trip, next booking, pool vehicles today |
| | `/fahrzeuge/[id]` | Vehicle detail (own trips, appointments, occupancy without names) |
| | `/buchen` (`?fahrzeug=id`) | Book a pool vehicle: overlap check, day timeline, free alternatives |
| | `/buchungen` | Own bookings (pick up / return / cancel) + own logbook per month |
| | `/fahrt/[id]` | Pickup (step 1) and return (step 2) for one booking |
| Admin | `/admin` | Vehicle list as table or cards; status tiles act as filter |
| | `/admin/fahrzeuge/[id]` | Detail with tabs + "Außer Betrieb nehmen" dialog |
| | `/admin/fahrzeuge/[id]/bearbeiten` | Edit with live validation; id `neu` creates a vehicle |
| | `/admin/wartung` (`?fahrzeug=id`) | Record maintenance, completes the appointment and sets the next deadline |
| | `/admin/benutzer` | Users: filter, activate/deactivate, switch role (not for yourself); new accounts are created in the Supabase dashboard |
| — | `/anmeldung` | Login with Supabase Auth (email + password) |

### Auth

- `@nuxtjs/supabase` with `redirect: true` sends signed-out users to `/anmeldung` (`redirectOptions` in `nuxt.config.ts`).
- `app/middleware/auth.global.ts` loads the user's row from `profiles` once per session into `useState('profile')`, signs out deactivated users (`/anmeldung?grund=deaktiviert`), redirects non-admins away from `/admin/*`, and reloads the fleet data on every navigation.
- `useSupabaseUser()` (v2) returns JWT claims: the user id is `user.value.sub`, not `.id`.
- The sidebar shows admin or employee navigation by route; admins can open employee pages too.

### Data access (`useFleet`, `app/utils/fleet.ts`)

- `useFleet()` holds all tables in `useState('fleet')` as `db.value.{vehicles, appointments, bookings, trips, maintenanceRecords, profiles}` and returns helpers (`findVehicle`, `getStatus`, `userName`, `runningBooking`, `activeBookings`, `dueAppointments`), `currentUser`, `flashMessage`, the shared `supabase` client, `reload()`, `write()` and `cancelBooking()`. RLS decides what each user gets (employees: all vehicles/bookings, only their own trips and profile).
- Reading: `reload()` loads every table and maps rows with `toVehicle`, `toBooking`, … (German snake_case → English camelCase). Never read Supabase rows directly in pages. `ponytail:` loading everything per navigation is fine for a few dozen vehicles; move to per-page queries or Realtime when data grows.
- Writing: `const message = await write(() => supabase.from('…').insert/update(...), …)` runs operations in order, stops at the first error, reloads on success and returns a German error text (`toUserMessage`: 23P01 overlap, 23505 duplicate plate, 42501 permission, SQL `raise exception` texts pass through) or `''`. Pages show it in a `meld meld-err` box. Write payloads use the German column names.
- Pickup/return must call the RPCs `fahrzeug_uebernehmen` / `fahrzeug_zurueckgeben`, never write `fahrten`/`buchungen` directly.
- Time: the app works with Berlin wall-clock strings `YYYY-MM-DDTHH:MM` (same format as `<input type="datetime-local">`, comparable as strings). `toLocalDateTime(timestamp)` converts DB timestamps (pinned to Europe/Berlin, so SSR and browser agree), `toTimestamp(local)` converts back for writes, `currentLocalTime()` is "now".
- Client-side checks mirror the DB rules (overlap, mileage never decreasing, plate format/uniqueness) for live feedback; the DB constraints stay the real guard.
- Success messages: set `flashMessage` before `navigateTo`; the next page's `PageHeader` shows it once and clears it.
- `ponytail:` the client is untyped (`useSupabaseClient<any>()` in `useFleet`, `supabase.types: false`) until `npx supabase gen types` → `app/types/database.types.ts` is set up; then type the client and drop the `any`.
- The Supabase project is hosted and shared. When testing against it, prefer reversible actions (book → cancel) and say what test data was left behind.

## Database

Business rules live in the database, not the app. SQL is run manually in the Supabase SQL editor (no Supabase CLI yet), in this order:

1. `migration.md` – base schema, functions, RLS.
2. `supabase/migrations/*.sql` in filename order – changes since then (idempotent). New schema changes go into a new timestamped file there; never edit an applied one.
3. `supabase/seed/01_admin.sql` – first admin (Katrin Albers). Set the password locally, never commit it (placeholder `CHANGE_ME` is refused).
4. Optional `supabase/seed/02_demo_data.sql` – the design's demo data (14 vehicles, appointments, bookings, logbook, 7 more accounts with one shared password), all dates relative to the day it runs. Runs only once.

Schema facts:

- Tables: `profiles` (`rolle` admin | mitarbeiter, `aktiv`, `abteilung`; auto-created by trigger on `auth.users` insert), `fahrzeuge` (`typ` Kleinwagen | Kombi | Transporter | Großraumtransporter, `hersteller` + `modell` → `vehicle.name`, `baujahr`, `status_notiz`, `kraftstoff`, `tankkarte`), `termine` (`art` Hauptuntersuchung | Inspektion | UVV-Prüfung | Wartung), `wartungen` (`art` HU | Inspektion | Wartung | Reparatur | Werkstattaufenthalt, `durchgefuehrt_von`), `buchungen`, `fahrten` (logbook, one per booking, `tank`, `hinweis`), `tankungen` (not used by the UI yet).
- Booking overlaps are prevented by a GiST exclusion constraint per vehicle (ignoring `storniert`).
- Mileage can never decrease (trigger `km_nicht_sinken`); `fahrten.rueckgabe_km >= uebernahme_km`.
- Pickup/return only via the `security definer` RPCs `fahrzeug_uebernehmen(p_buchung, p_km, p_zweck)` and `fahrzeug_zurueckgeben(p_buchung, p_km, p_tank, p_hinweis)`; they check owner, period, vehicle status, write `fahrten`, update `fahrzeuge.kilometerstand` and advance `buchungen.status` (`gebucht` → `uebernommen` → `zurueckgegeben`).
- RLS via `is_admin()` / `is_aktiv()`: admins write everything; employees read vehicles/appointments/bookings, book only pool vehicles (`pool = true`, not `ausser_betrieb`) in their own name, may only cancel their own `gebucht` bookings, and see only their own `fahrten`/`tankungen`/profile. There are no policies for `anon`: signed out, every table returns `[]`.
- A query that unexpectedly returns `[]` usually means a missing policy, an inactive profile, or no session.
- New accounts: Supabase dashboard → Authentication → Add user (profile is created as `mitarbeiter`), then make admins in `/admin/benutzer`.
- SQL can be checked locally without touching the hosted DB using PGlite (Postgres in WASM, with `pgcrypto`/`btree_gist`) and a small `auth` schema stub.

## UI design

The target UI is a claude.ai Design canvas ("Fuhrpark – SensorTec Automation", https://claude.ai/artifact/WEu9WNnDdtkruYbgqZFjZa). Its `project/fuhrpark.css` defines the design system (navy/sky accents; status colors green = verfügbar, blue = in Nutzung, orange = fällig/Werkstatt, red = überfällig, hatching = außer Betrieb — status is always shape + color + text; fonts Barlow Semi Condensed / IBM Plex Sans / IBM Plex Mono).

- The design CSS is copied almost verbatim into `app/assets/css/main.css` (plus page-specific rules from the artboards). Style with these classes, not ad-hoc Tailwind — keep markup close to the artboards so design updates can be diffed. Tailwind's preflight is intentionally not imported (it would override the design's base styles); theme + utilities are available.
- Fonts come from Google Fonts via `app.head` in `nuxt.config.ts`.
- Icons: `<AppIcon name="…">` with the design's inline SVG paths (exact look, works offline) — no icon library; add new paths to `AppIcon`. Vehicle silhouettes per size: `<VehicleIcon :type>`.
- Display status (`getDisplayStatus`): `ok | gebucht | werkstatt | aus`, derived from `vehicle.status` plus a running booking (`uebernommen` → "in Nutzung"). Appointment status (`getAppointmentStatus`): `ok | faellig` (≤ 30 days) `| ueber`. These values double as CSS modifiers.
- Only the desktop artboards are implemented; below 860 px the sidebar becomes a top bar (responsive CSS). The separate tablet/phone artboards (bottom nav, filter sheet) are not built.
- Deviations from the design: the vehicle form has separate fields for Hersteller, Modell and Baujahr (DB columns); Stammdaten shows Baujahr instead of Erstzulassung; seats are derived from the size (`seatsFor`), not stored; the login page has no "Passwort vergessen" flow and no attempt counter (Supabase rate-limits).
