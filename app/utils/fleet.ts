// Mock data + pure helpers (no Nuxt dependencies, so `npm test` can load this file directly).
// Fields and collections are English; migration.md uses German table/column names (fahrzeuge.kennzeichen, …),
// so the Supabase layer in useFleet will have to map them. Enum values (gebucht, ausser_betrieb, …) match the DB.

export const VEHICLE_TYPES = ['Kleinwagen', 'Kombi', 'Transporter', 'Großraumtransporter'] as const
export type VehicleType = typeof VEHICLE_TYPES[number]
export const seatsFor = (type: VehicleType) => type === 'Kleinwagen' || type === 'Kombi' ? 5 : 3
// Values double as CSS modifiers from the design (st-ok, mk-gebucht, …)
export type DisplayStatus = 'ok' | 'gebucht' | 'werkstatt' | 'aus'

export interface Vehicle {
  id: string
  plate: string
  model: string
  type: VehicleType
  seats: number
  mileage: number
  status: 'verfuegbar' | 'in_wartung' | 'ausser_betrieb'
  pool: boolean
  statusNote?: string
  firstRegistration?: string
  fuelType?: string
  fuelCard?: string
}
export interface Appointment { id: string, vehicleId: string, type: 'Hauptuntersuchung' | 'Inspektion' | 'UVV-Prüfung', dueDate: string, done: boolean }
export interface Booking { id: string, vehicleId: string, userId: string, from: string, until: string, purpose: string, status: 'gebucht' | 'uebernommen' | 'zurueckgegeben' | 'storniert' }
export interface Trip { id: string, bookingId: string, vehicleId: string, userId: string, pickupTime: string, pickupMileage: number, returnTime?: string, returnMileage?: number, purpose: string, fuelLevel?: string, note?: string }
export interface Maintenance { id: string, vehicleId: string, type: 'HU' | 'Inspektion' | 'Wartung' | 'Reparatur', date: string, mileage: number, performedBy: string, description: string }
export interface Profile { id: string, email: string, name: string, role: 'admin' | 'mitarbeiter', active: boolean, department: string }

// ponytail: fixed "now" matching the mock data; replace with the current time once real data is used.
// Times are local strings in <input type="datetime-local"> format (YYYY-MM-DDTHH:MM) and compare correctly
// as strings; switch to timestamptz with Supabase.
export const NOW = '2026-10-13T10:00'

const vehicle = (nr: number, model: string, type: VehicleType, km: number, extra: Partial<Vehicle> = {}): Vehicle => ({
  id: `fz${nr}`, plate: `OS-ST ${nr}`, model, type, seats: seatsFor(type),
  mileage: km, status: 'verfuegbar', pool: false, ...extra,
})
const appointment = (nr: number, type: Appointment['type'], dueDate: string): Appointment =>
  ({ id: `t${nr}-${type}`, vehicleId: `fz${nr}`, type, dueDate, done: false })
const booking = (id: string, nr: number, user: string, from: string, until: string, purpose: string, status: Booking['status'] = 'gebucht'): Booking =>
  ({ id, vehicleId: `fz${nr}`, userId: `u-${user}`, from, until, purpose, status })
const trip = (id: string, nr: number, user: string, time: string, startKm: number, endKm: number | undefined, purpose: string): Trip =>
  ({ id, bookingId: id, vehicleId: `fz${nr}`, userId: `u-${user}`, pickupTime: time, pickupMileage: startKm, returnMileage: endKm, returnTime: endKm ? time : undefined, purpose })
const profile = (id: string, name: string, role: Profile['role'], department = '', active = true): Profile =>
  ({ id: `u-${id}`, email: `${name[0]!.toLowerCase()}.${id}@sensortec-automation.de`, name, role, active, department })

export const MOCK_DATA = {
  vehicles: [
    vehicle(118, 'VW Polo', 'Kleinwagen', 27903),
    vehicle(139, 'Seat Ibiza', 'Kleinwagen', 61870),
    vehicle(152, 'VW Golf Variant', 'Kombi', 73415, { pool: true }),
    vehicle(184, 'Opel Astra Sports Tourer', 'Kombi', 141207, { status: 'ausser_betrieb', statusNote: 'seit 01.09.2026' }),
    vehicle(207, 'Opel Vivaro', 'Transporter', 112904, { status: 'in_wartung', statusNote: 'Vertragswerkstatt · seit 12.10.' }),
    vehicle(226, 'Ford Transit Custom', 'Transporter', 58761, { pool: true }),
    vehicle(263, 'Ford Focus Turnier', 'Kombi', 48320),
    vehicle(271, 'Skoda Octavia Combi', 'Kombi', 39552),
    vehicle(298, 'Skoda Fabia Combi', 'Kombi', 33480),
    vehicle(316, 'VW Passat Variant', 'Kombi', 102336),
    vehicle(355, 'VW Caddy', 'Transporter', 95118),
    vehicle(371, 'Seat Leon ST', 'Kombi', 44019),
    vehicle(398, 'VW ID.3', 'Kleinwagen', 18652, { pool: true, fuelType: 'Elektro' }),
    vehicle(412, 'VW Crafter 35', 'Großraumtransporter', 86240, { pool: true, firstRegistration: '04/2022', fuelType: 'Diesel', fuelCard: '4471' }),
  ],
  appointments: [
    appointment(139, 'Hauptuntersuchung', '2026-11-01'),
    appointment(207, 'Hauptuntersuchung', '2026-09-01'),
    appointment(207, 'Inspektion', '2026-11-05'),
    appointment(355, 'Inspektion', '2026-09-30'),
    appointment(412, 'Inspektion', '2026-10-28'),
    appointment(412, 'Hauptuntersuchung', '2027-04-01'),
    appointment(412, 'UVV-Prüfung', '2027-02-01'),
    appointment(152, 'Hauptuntersuchung', '2027-06-01'),
    appointment(226, 'Hauptuntersuchung', '2027-03-01'),
  ],
  bookings: [
    booking('b1', 412, 'wessels', '2026-10-13T08:00', '2026-10-13T16:00', 'Kundentermin Bramsche', 'uebernommen'),
    booking('b2', 412, 'meyer', '2026-10-14T08:00', '2026-10-14T16:00', 'Montage Lingen'),
    booking('b3', 412, 'brinkmann', '2026-10-16T07:00', '2026-10-16T18:00', 'Materialtransport'),
    booking('b4', 226, 'wessels', '2026-10-19T07:30', '2026-10-19T12:00', 'Messeaufbau Hannover'),
    booking('b5', 152, 'wessels', '2026-10-29T08:00', '2026-10-29T17:00', 'Schulung Münster'),
    booking('b6', 263, 'brinkmann', '2026-10-13T08:00', '2026-10-13T17:00', 'Kundentermin Osnabrück', 'uebernommen'),
    booking('b7', 271, 'meyer', '2026-10-12T08:00', '2026-10-15T17:00', 'Montage Meppen', 'uebernommen'),
    booking('b8', 152, 'rolfes', '2026-10-21T08:00', '2026-10-21T16:00', 'Kundentermin Münster'),
    booking('b9', 152, 'kruse', '2026-10-23T08:00', '2026-10-23T16:00', 'Messe Dortmund'),
    booking('b10', 398, 'wessels', '2026-10-13T09:00', '2026-10-13T13:00', 'Ersatzteile abholen Melle'),
  ],
  trips: [
    trip('b1', 412, 'wessels', '2026-10-13T08:00', 86240, undefined, 'Kundentermin Bramsche'),
    trip('b6', 263, 'brinkmann', '2026-10-13T08:00', 48320, undefined, 'Kundentermin Osnabrück'),
    trip('b7', 271, 'meyer', '2026-10-12T08:00', 39552, undefined, 'Montage Meppen'),
    trip('a1', 412, 'wessels', '2026-10-12T08:00', 86012, 86240, 'Kundentermin Bramsche'),
    trip('a2', 398, 'wessels', '2026-10-09T08:00', 18511, 18652, 'Kundentermin Lingen'),
    trip('a3', 412, 'brinkmann', '2026-10-08T08:00', 85871, 86012, 'Materiallieferung Lingen'),
    trip('a4', 412, 'wessels', '2026-10-06T08:00', 85790, 85871, 'Montage Georgsmarienhütte'),
    trip('a5', 152, 'wessels', '2026-10-02T08:00', 73210, 73415, 'Kundentermin Bielefeld'),
    trip('a6', 412, 'meyer', '2026-10-01T08:00', 85402, 85790, 'Messe Hannover'),
    trip('a7', 152, 'wessels', '2026-09-24T08:00', 72980, 73210, 'Kundentermin Bremen'),
  ],
  maintenanceRecords: [
    { id: 'w1', vehicleId: 'fz412', type: 'Inspektion', date: '2026-04-14', mileage: 70112, performedBy: 'Vertragswerkstatt Osnabrück', description: 'Ölwechsel, Bremsflüssigkeit' },
    { id: 'w2', vehicleId: 'fz412', type: 'HU', date: '2025-04-22', mileage: 52904, performedBy: 'Prüfstelle Osnabrück', description: 'ohne Mängel' },
    { id: 'w3', vehicleId: 'fz412', type: 'Reparatur', date: '2025-02-03', mileage: 49380, performedBy: 'Vertragswerkstatt Osnabrück', description: 'Schiebetür rechts, Führungsschiene erneuert' },
  ] as Maintenance[],
  profiles: [
    profile('albers', 'Katrin Albers', 'admin', 'Logistik'),
    profile('huelsmann', 'Markus Hülsmann', 'admin', 'Logistik'),
    profile('wessels', 'Thomas Wessels', 'mitarbeiter', 'Vertrieb'),
    profile('brinkmann', 'Anna Brinkmann', 'mitarbeiter', 'Vertrieb'),
    profile('meyer', 'Jonas Meyer', 'mitarbeiter', 'Montage'),
    profile('rolfes', 'Sabine Rolfes', 'mitarbeiter', 'Vertrieb'),
    profile('kruse', 'Dennis Kruse', 'mitarbeiter', 'Montage'),
    profile('lammers', 'Petra Lammers', 'mitarbeiter', 'Einkauf', false),
  ],
}

// ---------- Supabase rows (German columns, see migration.md) → app entities ----------
export interface ProfileRow { id: string, email: string, name: string, rolle: Profile['role'], aktiv: boolean, abteilung: string }
export const PROFILE_COLUMNS = 'id, email, name, rolle, aktiv, abteilung'
export const toProfile = (row: ProfileRow): Profile =>
  ({ id: row.id, email: row.email, name: row.name || row.email, role: row.rolle, active: row.aktiv, department: row.abteilung })

// ---------- Status ----------
export const STATUS_LABEL: Record<string, string> = { ok: 'verfügbar', gebucht: 'in Nutzung', werkstatt: 'Werkstatt', aus: 'außer Betrieb', ueber: 'überfällig', faellig: 'fällig' }

export const getDisplayStatus = (vehicle: Vehicle, bookings: Booking[]): DisplayStatus =>
  vehicle.status === 'ausser_betrieb' ? 'aus'
    : vehicle.status === 'in_wartung' ? 'werkstatt'
      : bookings.some(b => b.vehicleId === vehicle.id && b.status === 'uebernommen') ? 'gebucht' : 'ok'

const daysUntil = (date: string, now = NOW) => Math.round((Date.parse(date.slice(0, 10)) - Date.parse(now.slice(0, 10))) / 864e5)

// An appointment counts as "due" 30 days before its deadline. Values match the CSS modifiers pk-ok/pk-faellig/pk-ueber.
export const getAppointmentStatus = (appointment: Appointment, now = NOW) => {
  const days = daysUntil(appointment.dueDate, now)
  return days < 0 ? 'ueber' : days <= 30 ? 'faellig' : 'ok'
}
export const getAppointmentShortName = (type: Appointment['type']) => ({ 'Hauptuntersuchung': 'HU', 'Inspektion': 'INSP', 'UVV-Prüfung': 'UVV' })[type]
export const formatAppointmentDate = (appointment: Appointment) => appointment.type === 'Inspektion'
  ? formatDate(appointment.dueDate)
  : `${appointment.dueDate.slice(5, 7)}/${appointment.dueDate.slice(0, 4)}`
export const getAppointmentText = (appointment: Appointment, now = NOW) => {
  const status = getAppointmentStatus(appointment, now)
  const date = formatAppointmentDate(appointment)
  return status === 'ueber' ? `überfällig seit ${date}`
    : status === 'faellig' ? `fällig ${date} · in ${daysUntil(appointment.dueDate, now)} Tagen`
      : `in Ordnung · ${date}`
}

// ---------- Validation (mirrors the constraints in migration.md) ----------
export const findOverlappingBooking = (bookings: Booking[], vehicleId: string, from: string, until: string) =>
  bookings.find(b => b.vehicleId === vehicleId && b.status !== 'storniert' && b.from < until && from < b.until)

export const normalizePlate = (plate: string) => plate.toUpperCase().replace(/\s+/g, ' ').trim()
export const getPlateError = (plate: string, takenPlates: string[]) => {
  const normalized = normalizePlate(plate)
  if (!normalized) return 'Bitte geben Sie ein Kennzeichen ein.'
  if (!/^[A-ZÄÖÜ]{1,3}-[A-Z]{1,2} \d{1,4}[EH]?$/.test(normalized)) return 'Bitte im Format OS-ST 123 eingeben.'
  if (takenPlates.some(taken => taken.replace(/ /g, '') === normalized.replace(/ /g, ''))) return 'Dieses Kennzeichen ist bereits vergeben.'
  return ''
}
export const parseMileage = (input: string) => {
  const mileage = Number.parseInt(input.replace(/\D/g, ''), 10)
  return Number.isNaN(mileage) ? null : mileage
}

// ---------- Formatting ----------
export const formatKm = (km: number) => km.toLocaleString('de-DE')
export const formatDate = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`
export const formatTime = (dateTime: string) => dateTime.slice(11, 16)
export const formatDay = (dateTime: string) => dateTime.slice(0, 10) === NOW.slice(0, 10)
  ? 'Heute'
  : `${new Date(dateTime.slice(0, 10)).toLocaleDateString('de-DE', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2)} ${dateTime.slice(8, 10)}.${dateTime.slice(5, 7)}.`
export const formatPeriod = (from: string, until: string) => from.slice(0, 10) === until.slice(0, 10)
  ? `${formatDay(from)} · ${formatTime(from)}–${formatTime(until)}`
  : `${formatDay(from)} ${formatTime(from)} – ${formatDay(until)} ${formatTime(until)}`
export const formatUntil = (until: string) => until.slice(0, 10) === NOW.slice(0, 10) ? `${formatTime(until)} Uhr` : `${until.slice(8, 10)}.${until.slice(5, 7)}.`
export const matches = (text: string, query: string) => text.toLowerCase().includes(query.trim().toLowerCase())
export const shortName = (name: string) => name.replace(/^(\S)\S*\s/, '$1. ')
export const initials = (name: string) => name.split(' ').map(part => part[0]).join('')
