import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findOverlappingBooking, getAppointmentStatus, getDisplayStatus, getPlateError, MOCK_DATA, parseMileage } from '../app/utils/fleet.ts'

test('overlap works like the exclusion constraint (cancelled bookings ignored, touching edges allowed)', () => {
  const bookings = MOCK_DATA.bookings
  assert.equal(findOverlappingBooking(bookings, 'fz412', '2026-10-14T07:30', '2026-10-14T12:00')?.id, 'b2')
  assert.equal(findOverlappingBooking(bookings, 'fz412', '2026-10-14T16:00', '2026-10-14T18:00'), undefined)
  assert.equal(findOverlappingBooking([{ ...bookings[1]!, status: 'storniert' }], 'fz412', '2026-10-14T07:30', '2026-10-14T12:00'), undefined)
})

test('number plate: format and uniqueness (whitespace ignored)', () => {
  assert.equal(getPlateError('os-st 420', ['OS-ST 412']), '')
  assert.match(getPlateError('OSST420', []), /Format/)
  assert.match(getPlateError('OS-ST412', ['OS-ST 412']), /Format/)
  assert.match(getPlateError(' os-st  412 ', ['OS-ST 412']), /vergeben/)
  assert.match(getPlateError('', []), /Kennzeichen ein/)
})

test('appointment status: overdue, 30-day window, ok', () => {
  const appointment = (dueDate: string) => ({ id: 'x', vehicleId: 'fz1', type: 'Inspektion' as const, dueDate, done: false })
  assert.equal(getAppointmentStatus(appointment('2026-10-12')), 'ueber')
  assert.equal(getAppointmentStatus(appointment('2026-11-12')), 'faellig')
  assert.equal(getAppointmentStatus(appointment('2026-11-13')), 'ok')
})

test('display status and mileage input', () => {
  const vehicle = (id: string) => MOCK_DATA.vehicles.find(v => v.id === id)!
  assert.equal(getDisplayStatus(vehicle('fz412'), MOCK_DATA.bookings), 'gebucht')
  assert.equal(getDisplayStatus(vehicle('fz184'), MOCK_DATA.bookings), 'aus')
  assert.equal(getDisplayStatus(vehicle('fz207'), MOCK_DATA.bookings), 'werkstatt')
  assert.equal(getDisplayStatus(vehicle('fz118'), MOCK_DATA.bookings), 'ok')
  assert.equal(parseMileage('86.240'), 86240)
  assert.equal(parseMileage(''), null)
})
