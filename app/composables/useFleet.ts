import type { Vehicle } from '~/utils/fleet'

// Mock data as shared state. Later: replace with Supabase queries here.
export const useFleet = () => {
  const db = useState('fleet', () => structuredClone(MOCK_DATA))
  const flashMessage = useState<{ title: string, text?: string } | null>('flashMessage', () => null)
  const route = useRoute()
  // ponytail: no login yet – the role follows the route (admin area = Katrin Albers)
  const currentUser = computed(() => db.value.profiles.find(p => p.id === (route.path.startsWith('/admin') ? 'u-albers' : 'u-wessels'))!)
  const findVehicle = (id: string) => db.value.vehicles.find(v => v.id === id)
  const getStatus = (vehicle: Vehicle) => getDisplayStatus(vehicle, db.value.bookings)
  const userName = (userId: string) => db.value.profiles.find(p => p.id === userId)?.name ?? ''
  const runningBooking = (vehicleId: string) => db.value.bookings.find(b => b.vehicleId === vehicleId && b.status === 'uebernommen')
  // Booked or currently running, in chronological order
  const activeBookings = (vehicleId: string) => db.value.bookings
    .filter(b => b.vehicleId === vehicleId && (b.status === 'gebucht' || b.status === 'uebernommen'))
    .sort((a, b) => a.from.localeCompare(b.from))
  const dueAppointments = (vehicleId: string) => db.value.appointments.filter(a => a.vehicleId === vehicleId && !a.done && getAppointmentStatus(a) !== 'ok')
  return { db, flashMessage, currentUser, findVehicle, getStatus, userName, runningBooking, activeBookings, dueAppointments }
}
