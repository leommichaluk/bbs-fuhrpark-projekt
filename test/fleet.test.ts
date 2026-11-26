import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Booking } from '../app/utils/fleet.ts'
import {
  findOverlappingBooking, getAppointmentStatus, getDisplayStatus, getPlateError, parseMileage,
  toBooking, toLocalDateTime, toTimestamp, toUserMessage, toVehicle,
} from '../app/utils/fleet.ts'

const booking = (id: string, from: string, until: string, status: Booking['status'] = 'gebucht'): Booking =>
  ({ id, vehicleId: 'v1', userId: 'u1', from, until, purpose: '', status })
const vehicleRow = (status: string) => ({ id: 'v1', kennzeichen: 'OS-ST 412', hersteller: 'VW', modell: 'Crafter 35', typ: 'Großraumtransporter', baujahr: 2022, kilometerstand: 86240, status, pool: true })

test('overlap works like the exclusion constraint (cancelled bookings ignored, touching edges allowed)', () => {
  const bookings = [booking('b1', '2026-10-14T08:00', '2026-10-14T16:00')]
  assert.equal(findOverlappingBooking(bookings, 'v1', '2026-10-14T07:30', '2026-10-14T12:00')?.id, 'b1')
  assert.equal(findOverlappingBooking(bookings, 'v1', '2026-10-14T16:00', '2026-10-14T18:00'), undefined)
  assert.equal(findOverlappingBooking(bookings, 'v2', '2026-10-14T07:30', '2026-10-14T12:00'), undefined)
  assert.equal(findOverlappingBooking([{ ...bookings[0]!, status: 'storniert' }], 'v1', '2026-10-14T07:30', '2026-10-14T12:00'), undefined)
})

test('number plate: format and uniqueness (whitespace ignored)', () => {
  assert.equal(getPlateError('os-st 420', ['OS-ST 412']), '')
  assert.match(getPlateError('OSST420', []), /Format/)
  assert.match(getPlateError('OS-ST412', ['OS-ST 412']), /Format/)
  assert.match(getPlateError(' os-st  412 ', ['OS-ST 412']), /vergeben/)
  assert.match(getPlateError('', []), /Kennzeichen ein/)
})

test('appointment status: overdue, 30-day window, ok', () => {
  const appointment = (dueDate: string) => ({ id: 'x', vehicleId: 'v1', type: 'Inspektion' as const, dueDate, done: false })
  const now = '2026-10-13T10:00'
  assert.equal(getAppointmentStatus(appointment('2026-10-12'), now), 'ueber')
  assert.equal(getAppointmentStatus(appointment('2026-11-12'), now), 'faellig')
  assert.equal(getAppointmentStatus(appointment('2026-11-13'), now), 'ok')
})

test('display status from vehicle status and running bookings', () => {
  const running = [booking('b1', '2026-10-13T08:00', '2026-10-13T16:00', 'uebernommen')]
  assert.equal(getDisplayStatus(toVehicle(vehicleRow('verfuegbar')), running), 'gebucht')
  assert.equal(getDisplayStatus(toVehicle(vehicleRow('verfuegbar')), []), 'ok')
  assert.equal(getDisplayStatus(toVehicle(vehicleRow('ausser_betrieb')), running), 'aus')
  assert.equal(getDisplayStatus(toVehicle(vehicleRow('in_wartung')), []), 'werkstatt')
  assert.equal(parseMileage('86.240'), 86240)
  assert.equal(parseMileage(''), null)
})

test('Berlin wall-clock time ↔ timestamptz, summer and winter time', () => {
  assert.equal(toTimestamp('2026-07-01T08:00'), '2026-07-01T06:00:00.000Z')
  assert.equal(toTimestamp('2026-01-15T08:00'), '2026-01-15T07:00:00.000Z')
  assert.equal(toLocalDateTime('2026-07-01T06:00:00+00:00'), '2026-07-01T08:00')
  assert.equal(toLocalDateTime(toTimestamp('2026-10-25T09:30')), '2026-10-25T09:30') // DST ends that night
})

test('DB rows map to entities', () => {
  const vehicle = toVehicle({ ...vehicleRow('verfuegbar'), status_notiz: null })
  assert.equal(vehicle.name, 'VW Crafter 35')
  assert.equal(vehicle.seats, 3)
  assert.equal(vehicle.statusNote, undefined)
  const mapped = toBooking({ id: 'b1', fahrzeug_id: 'v1', user_id: 'u1', von: '2026-10-14T06:00:00+00:00', bis: '2026-10-14T14:00:00+00:00', zweck: 'Messe', status: 'gebucht' })
  assert.deepEqual([mapped.from, mapped.until, mapped.purpose], ['2026-10-14T08:00', '2026-10-14T16:00', 'Messe'])
})

test('DB errors become German UI messages', () => {
  assert.match(toUserMessage({ code: '23P01', message: 'conflicting key value violates exclusion constraint' }), /überschneidet/)
  assert.match(toUserMessage({ code: '23505', message: 'duplicate key' }), /Kennzeichen/)
  assert.equal(toUserMessage({ code: 'P0001', message: 'Außerhalb des Buchungszeitraums.' }), 'Außerhalb des Buchungszeitraums.')
})
