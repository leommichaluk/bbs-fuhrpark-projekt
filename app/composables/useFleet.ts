import type { Appointment, Booking, Maintenance, Profile, ProfileRow, Trip, Vehicle } from '~/utils/fleet'

interface FleetData {
  vehicles: Vehicle[]
  appointments: Appointment[]
  bookings: Booking[]
  trips: Trip[]
  maintenanceRecords: Maintenance[]
  profiles: Profile[]
}
const emptyFleet = (): FleetData => ({ vehicles: [], appointments: [], bookings: [], trips: [], maintenanceRecords: [], profiles: [] })

// Fleet data from Supabase as shared state. RLS decides what each user sees
// (employees: all vehicles/bookings, but only their own trips and profile).
export const useFleet = () => {
  // ponytail: untyped client until `npx supabase gen types` → app/types/database.types.ts (then drop the `any`
  // and `supabase.types: false` in nuxt.config.ts); without it insert/update/rpc reject every payload as `never`.
  // oxlint-disable-next-line no-explicit-any
  const supabase = useSupabaseClient<any>()
  const db = useState<FleetData>('fleet', emptyFleet)
  const flashMessage = useState<{ title: string, text?: string } | null>('flashMessage', () => null)
  // Signed-in user, loaded from Supabase by middleware/auth.global.ts
  const profile = useState<Profile | null>('profile', () => null)
  const currentUser = computed(() => profile.value!)

  // ponytail: loads all tables on every navigation – fine for a fleet of a few dozen vehicles;
  // switch to per-page queries or Supabase Realtime when the data grows.
  const reload = async () => {
    const results = await Promise.all([
      supabase.from('fahrzeuge').select('*').order('kennzeichen'),
      supabase.from('termine').select('*'),
      supabase.from('buchungen').select('*'),
      supabase.from('fahrten').select('*'),
      supabase.from('wartungen').select('*'),
      supabase.from('profiles').select(PROFILE_COLUMNS).order('name'),
    ])
    const failed = results.find(r => r.error)
    if (failed) throw createError({ statusCode: 500, statusMessage: 'Daten konnten nicht geladen werden', cause: failed.error })
    const [vehicles, appointments, bookings, trips, maintenanceRecords, profiles] = results.map(r => r.data ?? [])
    db.value = {
      vehicles: vehicles!.map(toVehicle),
      appointments: appointments!.map(toAppointment),
      bookings: bookings!.map(toBooking),
      trips: trips!.map(toTrip),
      maintenanceRecords: maintenanceRecords!.map(toMaintenance),
      profiles: profiles!.map(row => toProfile(row as ProfileRow)),
    }
  }

  // Runs Supabase writes in order, stops at the first error and reloads the data on success.
  // Returns a German error message for the UI, '' on success.
  const write = async (...operations: (() => PromiseLike<{ error: { code?: string, message: string } | null }>)[]) => {
    for (const operation of operations) {
      const { error } = await operation()
      if (error) return toUserMessage(error)
    }
    await reload()
    return ''
  }

  // Employees may only cancel their own bookings that are still 'gebucht' (RLS policy buchungen_cancel)
  const cancelBooking = (bookingId: string) => write(() => supabase.from('buchungen').update({ status: 'storniert' }).eq('id', bookingId))

  const findVehicle = (id: string) => db.value.vehicles.find(v => v.id === id)
  const getStatus = (vehicle: Vehicle) => getDisplayStatus(vehicle, db.value.bookings)
  const userName = (userId: string) => db.value.profiles.find(p => p.id === userId)?.name ?? ''
  const runningBooking = (vehicleId: string) => db.value.bookings.find(b => b.vehicleId === vehicleId && b.status === 'uebernommen')
  // Booked or currently running, in chronological order
  const activeBookings = (vehicleId: string) => db.value.bookings
    .filter(b => b.vehicleId === vehicleId && (b.status === 'gebucht' || b.status === 'uebernommen'))
    .sort((a, b) => a.from.localeCompare(b.from))
  const dueAppointments = (vehicleId: string) => db.value.appointments.filter(a => a.vehicleId === vehicleId && !a.done && getAppointmentStatus(a) !== 'ok')
  return { supabase, db, reload, write, cancelBooking, flashMessage, currentUser, findVehicle, getStatus, userName, runningBooking, activeBookings, dueAppointments }
}
