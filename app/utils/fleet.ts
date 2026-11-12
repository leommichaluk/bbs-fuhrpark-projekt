// Entity types, Supabase row mappers and pure helpers (no Nuxt dependencies, so `npm test` can load this file directly).
// Fields are English; the DB (migration.md, supabase/migrations) uses German snake_case columns, mapped below.
// Enum values (gebucht, ausser_betrieb, …) are the DB values and double as CSS modifiers from the design.

export const VEHICLE_TYPES = ['Kleinwagen', 'Kombi', 'Transporter', 'Großraumtransporter'] as const
export type VehicleType = typeof VEHICLE_TYPES[number]
export const seatsFor = (type: VehicleType) => type === 'Kleinwagen' || type === 'Kombi' ? 5 : 3
export type DisplayStatus = 'ok' | 'gebucht' | 'werkstatt' | 'aus'

export interface Vehicle {
  id: string
  plate: string
  manufacturer: string
  model: string
  name: string // "VW Crafter 35" = manufacturer + model, for display
  type: VehicleType
  seats: number
  buildYear: number
  mileage: number
  status: 'verfuegbar' | 'in_wartung' | 'ausser_betrieb'
  pool: boolean
  statusNote?: string
  fuelType?: string
  fuelCard?: string
}
export interface Appointment { id: string, vehicleId: string, type: 'Hauptuntersuchung' | 'Inspektion' | 'UVV-Prüfung' | 'Wartung', dueDate: string, done: boolean }
export interface Booking { id: string, vehicleId: string, userId: string, from: string, until: string, purpose: string, status: 'gebucht' | 'uebernommen' | 'zurueckgegeben' | 'storniert' }
export interface Trip { id: string, bookingId: string, vehicleId: string, userId: string, pickupTime: string, pickupMileage: number, returnTime?: string, returnMileage?: number, purpose: string, fuelLevel?: string, note?: string }
export interface Maintenance { id: string, vehicleId: string, type: 'HU' | 'Inspektion' | 'Wartung' | 'Reparatur' | 'Werkstattaufenthalt', date: string, mileage: number, performedBy: string, description: string }
export interface Profile { id: string, email: string, name: string, role: 'admin' | 'mitarbeiter', active: boolean, department: string }

// ---------- Time ----------
// The app works with local wall-clock strings as used by <input type="datetime-local"> (YYYY-MM-DDTHH:MM);
// they compare correctly as strings. Formatting is pinned to Europe/Berlin so server render and browser agree.
const BERLIN = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
export const toLocalDateTime = (timestamp: string | Date) => BERLIN.format(new Date(timestamp)).replace(' ', 'T')
export const currentLocalTime = () => toLocalDateTime(new Date())
// Local Berlin wall-clock string → ISO timestamp for timestamptz columns.
// ponytail: off by one hour for times inside the DST switch gap (Sunday 02:00–03:00 in March), irrelevant for bookings
export const toTimestamp = (local: string) => {
  const asUtc = Date.parse(`${local}:00Z`)
  const berlinOffset = Date.parse(`${toLocalDateTime(new Date(asUtc))}:00Z`) - asUtc
  return new Date(asUtc - berlinOffset).toISOString()
}

// ---------- Supabase errors → German UI text ----------
export const toUserMessage = (error: { code?: string, message: string }) => ({
  '23P01': 'Der Zeitraum überschneidet sich mit einer anderen Buchung dieses Fahrzeugs.',
  '23505': 'Dieses Kennzeichen ist bereits vergeben.',
  '42501': 'Dafür fehlt Ihnen die Berechtigung.',
  '23514': 'Eine Eingabe ist ungültig. Bitte prüfen Sie die Werte.',
}[error.code ?? ''] ?? error.message) // P0001 = raise exception in the SQL functions, already German

// ---------- Supabase rows (German columns) → app entities ----------
// ponytail: rows are untyped until `supabase gen types` is set up (supabase.types: false in nuxt.config.ts)
// oxlint-disable-next-line no-explicit-any
type Row = Record<string, any>
export const toVehicle = (r: Row): Vehicle => ({
  id: r.id, plate: r.kennzeichen, manufacturer: r.hersteller, model: r.modell, name: `${r.hersteller} ${r.modell}`.trim(),
  type: r.typ, seats: seatsFor(r.typ), buildYear: r.baujahr, mileage: r.kilometerstand, status: r.status, pool: r.pool,
  statusNote: r.status_notiz ?? undefined, fuelType: r.kraftstoff ?? undefined, fuelCard: r.tankkarte ?? undefined,
})
export const toAppointment = (r: Row): Appointment => ({ id: r.id, vehicleId: r.fahrzeug_id, type: r.art, dueDate: r.faellig_am, done: r.erledigt })
export const toBooking = (r: Row): Booking => ({
  id: r.id, vehicleId: r.fahrzeug_id, userId: r.user_id, from: toLocalDateTime(r.von), until: toLocalDateTime(r.bis), purpose: r.zweck, status: r.status,
})
export const toTrip = (r: Row): Trip => ({
  id: r.id, bookingId: r.buchung_id, vehicleId: r.fahrzeug_id, userId: r.user_id,
  pickupTime: toLocalDateTime(r.uebernahme_zeit), pickupMileage: r.uebernahme_km,
  returnTime: r.rueckgabe_zeit ? toLocalDateTime(r.rueckgabe_zeit) : undefined, returnMileage: r.rueckgabe_km ?? undefined,
  purpose: r.zweck, fuelLevel: r.tank ?? undefined, note: r.hinweis ?? undefined,
})
export const toMaintenance = (r: Row): Maintenance => ({
  id: r.id, vehicleId: r.fahrzeug_id, type: r.art, date: r.datum, mileage: r.kilometerstand, performedBy: r.durchgefuehrt_von, description: r.beschreibung,
})
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

const daysUntil = (date: string, now = currentLocalTime()) => Math.round((Date.parse(date.slice(0, 10)) - Date.parse(now.slice(0, 10))) / 864e5)

// An appointment counts as "due" 30 days before its deadline. Values match the CSS modifiers pk-ok/pk-faellig/pk-ueber.
export const getAppointmentStatus = (appointment: Appointment, now = currentLocalTime()) => {
  const days = daysUntil(appointment.dueDate, now)
  return days < 0 ? 'ueber' : days <= 30 ? 'faellig' : 'ok'
}
export const getAppointmentShortName = (type: Appointment['type']) => ({ 'Hauptuntersuchung': 'HU', 'Inspektion': 'INSP', 'UVV-Prüfung': 'UVV', 'Wartung': 'WART' })[type]
export const formatAppointmentDate = (appointment: Appointment) => appointment.type === 'Inspektion'
  ? formatDate(appointment.dueDate)
  : `${appointment.dueDate.slice(5, 7)}/${appointment.dueDate.slice(0, 4)}`
export const getAppointmentText = (appointment: Appointment, now = currentLocalTime()) => {
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
export const formatDay = (dateTime: string) => dateTime.slice(0, 10) === currentLocalTime().slice(0, 10)
  ? 'Heute'
  : `${new Date(dateTime.slice(0, 10)).toLocaleDateString('de-DE', { weekday: 'short', timeZone: 'UTC' }).slice(0, 2)} ${dateTime.slice(8, 10)}.${dateTime.slice(5, 7)}.`
export const formatPeriod = (from: string, until: string) => from.slice(0, 10) === until.slice(0, 10)
  ? `${formatDay(from)} · ${formatTime(from)}–${formatTime(until)}`
  : `${formatDay(from)} ${formatTime(from)} – ${formatDay(until)} ${formatTime(until)}`
export const formatUntil = (until: string) => until.slice(0, 10) === currentLocalTime().slice(0, 10) ? `${formatTime(until)} Uhr` : `${until.slice(8, 10)}.${until.slice(5, 7)}.`
export const matches = (text: string, query: string) => text.toLowerCase().includes(query.trim().toLowerCase())
export const shortName = (name: string) => name.replace(/^(\S)\S*\s/, '$1. ')
export const initials = (name: string) => name.split(' ').map(part => part[0]).join('')
