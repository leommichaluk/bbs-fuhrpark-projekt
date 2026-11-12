# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Fleet management ("Fuhrparkverwaltung") for SensorTec Automation GmbH. Nuxt 4 + Supabase, Tailwind v4.

## Code conventions

- **Code identifiers in English and descriptive**: variables, functions, components, composables, types (`decommissionDialog`, `dateFrom`, `findOverlappingBooking`, `useFleet` — not `dlg`, `ab`, `ueberschneidung`).
- **Data fields and collections in English too** (`booking.purpose`, `vehicle.plate`, `appointment.dueDate`, `db.value.vehicles`), camelCase.
- **German stays German**: the SQL schema in `migration.md` (`fahrzeuge.kennzeichen`, …), enum values (`gebucht`, `ausser_betrieb`, …), route paths (`/buchen`, `/admin/wartung`), all UI text, and the design's CSS class names/modifiers (`st-gebucht`, `mk-aus`, `.feld`, `.btn-p`).
- Arrow functions everywhere (`const save = () => {}`), `<script setup lang="ts">` in components.
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

`.env` must contain `NUXT_PUBLIC_SUPABASE_URL` and `NUXT_PUBLIC_SUPABASE_KEY` (anon/publishable key, from Supabase → Project Settings → API).

## Architecture

- Nuxt 4 `app/` directory layout: file-based routes in `app/pages/`, auto-imported `components/`, `composables/`, `utils/`. One layout (`app/layouts/default.vue`, sidebar nav that switches between employee and admin items by route); `anmeldung.vue` uses `layout: false`. Each page's root element is `<main class="main">` and starts with `<PageHeader>`.
- Modules: `@nuxtjs/supabase`, `@nuxt/icon`, `@nuxt/image`. Tailwind v4 via `@tailwindcss/vite`, entry `app/assets/css/main.css`.

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
| | `/admin/benutzer` | Users: filter, activate/deactivate, create |
| — | `/anmeldung` | Login (mock) |

### Current phase: mock data, no Supabase/API yet

- All data lives in `MOCK_DATA` in `app/utils/fleet.ts` (types, mock rows, pure helpers for status, validation, formatting). Entity types (`Vehicle`, `Booking`, `Trip`, …) use English camelCase fields; `MOCK_DATA` keys are `vehicles`, `appointments`, `bookings`, `trips`, `maintenanceRecords`, `profiles`. When connecting Supabase, map the German snake_case columns (`fahrzeuge.kennzeichen` → `plate`, `buchungen.zweck` → `purpose`, …) in one place in `useFleet`, not in pages.
- `useFleet()` (`app/composables/useFleet.ts`) puts a clone into `useState('fleet')` and returns `db`, `currentUser`, `findVehicle`, `getStatus`, `userName`, `runningBooking`, `activeBookings`, `dueAppointments`, `flashMessage`. Pages mutate `db.value.*` directly — this is the one place to replace with Supabase queries/RPCs later.
- No login: `currentUser` follows the route (`/admin/*` → Katrin Albers, admin; everything else → Thomas Wessels, employee). The login page accepts any active mock email (`k.albers@…`, `t.wessels@sensortec-automation.de`) with any password.
- "Now" is the fixed constant `NOW = '2026-10-13T10:00'` so the mock data stays consistent. Date-times are local strings in `datetime-local` format (`YYYY-MM-DDTHH:MM`) and are compared as strings; switch to real time/`timestamptz` with Supabase.
- Client-side rules mirror the DB constraints (overlap, mileage never decreasing, plate format/uniqueness) for live feedback — the DB stays the source of truth.
- Success messages after an action: set `flashMessage` before `navigateTo`; the next page's `PageHeader` shows it once and clears it.
- A full page reload resets all mock state (it is per-request `useState`).

### Later: Supabase

- Auth is not wired up yet: `supabase.redirect: false` and `supabase.types: false` in `nuxt.config.ts`. Once types are generated (`npx supabase gen types` → `app/types/database.types.ts`) remove `types: false`; set `redirect: true` once a login exists.
- Data access pattern: `useSupabaseClient()` inside `useAsyncData`, throwing on `error`. Pickup/return must call the RPCs, not write tables directly.

## Database (`migration.md`)

`migration.md` holds the full SQL schema + RLS, to be run in the Supabase SQL editor. Business rules live in the database, not the app:

- Tables: `profiles` (role `admin` | `mitarbeiter`, `aktiv` flag; auto-created by trigger on `auth.users` insert), `fahrzeuge`, `wartungen`, `termine` (HU/Inspektion/Wartung due dates), `buchungen`, `fahrten` (logbook, one per booking), `tankungen`.
- Booking overlaps are prevented by a GiST exclusion constraint per vehicle (ignoring `storniert`).
- Mileage can never decrease (trigger `km_nicht_sinken`); `fahrten.rueckgabe_km >= uebernahme_km`.
- Vehicle pickup/return go only through the `security definer` RPCs `fahrzeug_uebernehmen(p_buchung, p_km, p_zweck)` and `fahrzeug_zurueckgeben(p_buchung, p_km)`; they write `fahrten`, update `fahrzeuge.kilometerstand` and advance `buchungen.status` (`gebucht` → `uebernommen` → `zurueckgegeben`).
- RLS via `is_admin()` / `is_aktiv()`: admins write everything; employees read vehicles/dates/bookings, book only pool vehicles (`pool = true`, not `ausser_betrieb`) in their own name, may only cancel their own `gebucht` bookings, and see only their own `fahrten`/`tankungen`.
- With RLS enabled, a table without a matching policy returns `[]` — check policies first when a query comes back empty.
- First admin: register, then `update profiles set rolle = 'admin' where email = '…';`.

## UI design

The target UI is a claude.ai Design canvas ("Fuhrpark – SensorTec Automation", https://claude.ai/artifact/WEu9WNnDdtkruYbgqZFjZa). Its `project/fuhrpark.css` defines the design system (navy/sky accents; status colors green = verfügbar, blue = in Nutzung, orange = fällig/Werkstatt, red = überfällig, hatching = außer Betrieb — status is always shape + color + text; fonts Barlow Semi Condensed / IBM Plex Sans / IBM Plex Mono).

- The design CSS is copied almost verbatim into `app/assets/css/main.css` (plus page-specific rules from the artboards). Style with these classes, not ad-hoc Tailwind — keep markup close to the artboards so design updates can be diffed. Tailwind's preflight is intentionally not imported (it would override the design's base styles); theme + utilities are available.
- Fonts come from Google Fonts via `app.head` in `nuxt.config.ts`.
- Icons: `<AppIcon name="…">` with the design's inline SVG paths (exact look, works offline) — not `@nuxt/icon`. Vehicle silhouettes per size: `<VehicleIcon :type>`.
- Display status (`getDisplayStatus`): `ok | gebucht | werkstatt | aus`, derived from `vehicle.status` plus a running booking (`uebernommen` → "in Nutzung"). Appointment status (`getAppointmentStatus`): `ok | faellig` (≤ 30 days) `| ueber`. These values double as CSS modifiers.
- Only the desktop artboards are implemented; below 860 px the sidebar becomes a top bar (responsive CSS). The separate tablet/phone artboards (bottom nav, filter sheet) are not built.
- Schema mismatches to resolve before Supabase: the design's size categories (Kleinwagen, Kombi, Transporter, Großraumtransporter) vs. the `fahrzeuge.typ` check constraint; "UVV-Prüfung" is not an allowed `termine.art`; manufacturer + model are one field (`model`) in the UI but two columns in the schema; mock-only fields (`seats`, `statusNote`, `firstRegistration`, `fuelType`, `fuelCard`, `fuelLevel`, `note`, `performedBy`, `department`) have no columns yet.
