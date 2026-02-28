import { useState, useEffect } from 'react'
import { db } from '../../firebase/firebase'
import { collection, getDocs, query, where, addDoc, onSnapshot } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'

// ─── Constants ───────────────────────────────────────────────
const SPECIALIZATIONS = [
  { label: 'General', icon: '🩺' },
  { label: 'Cardiology', icon: '❤️' },
  { label: 'Dermatology', icon: '🧴' },
  { label: 'Neurology', icon: '🧠' },
  { label: 'Orthopedics', icon: '🦴' },
  { label: 'Pediatrics', icon: '👶' },
  { label: 'Gynecology', icon: '🌸' },
  { label: 'ENT', icon: '👂' },
  { label: 'Ophthalmology', icon: '👁️' },
]

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// ─── Helpers ─────────────────────────────────────────────────

// SAFE: get day name from "YYYY-MM-DD" without UTC shift
function dayNameFromDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return DAY_NAMES[new Date(y, m - 1, d).getDay()]
}

// SAFE: today as "YYYY-MM-DD" in local time
function localToday() {
  const n = new Date()
  return [
    n.getFullYear(),
    String(n.getMonth() + 1).padStart(2, '0'),
    String(n.getDate()).padStart(2, '0'),
  ].join('-')
}

// Generate time slots between start and end with duration (minutes)
function makeSlots(start, end, durationMin) {
  const result = []
  const toMins = (t) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  let cur = toMins(start)
  const endM = toMins(end)
  while (cur + durationMin <= endM) {
    const h = Math.floor(cur / 60)
    const m = cur % 60
    result.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    cur += durationMin
  }
  return result
}

// Get slots for a doctor on a specific date
// Returns: { slots: string[], reason: 'ok'|'off'|'dayoff'|'noavail' }
function getSlotsForDate(doctor, dateStr) {
  const avail = doctor.availability          // may be null
  const duration = Number(doctor.consultationDuration) || 30
  const dayName = dayNameFromDateStr(dateStr)

  if (!avail) {
    // No availability doc → use default schedule (always show slots)
    return { slots: makeSlots('09:00', '17:00', duration), reason: 'ok' }
  }

  // Check off dates first
  if (Array.isArray(avail.offDates) && avail.offDates.includes(dateStr)) {
    return { slots: [], reason: 'off' }
  }

  // Check working days
  const daySchedule = avail.workingDays && avail.workingDays[dayName]
  if (!daySchedule) {
    return { slots: [], reason: 'dayoff' }
  }

  const start = daySchedule.start || '09:00'
  const end = daySchedule.end || '17:00'
  return { slots: makeSlots(start, end, duration), reason: 'ok' }
}

// ─── Component ───────────────────────────────────────────────
export default function BookAppointment() {
  const { user } = useAuth()

  const [step, setStep] = useState(1)
  const [specialization, setSpecialization] = useState('')
  const [doctors, setDoctors] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [allSlots, setAllSlots] = useState([])      // every slot for the day
  const [bookedSlots, setBookedSlots] = useState([])      // already booked
  const [slotReason, setSlotReason] = useState('')      // 'ok'|'off'|'dayoff'
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [reason, setReason] = useState('')
  const [booking, setBooking] = useState(false)
  const [success, setSuccess] = useState(false)

  // ── Step 2: Load doctors ──────────────────────────────────
  async function loadDoctors(spec) {
    setLoadingDocs(true)
    setDoctors([])
    try {
      // Fetch doctors matching specialization
      const docSnap = await getDocs(
        query(collection(db, 'doctors'), where('specialization', '==', spec))
      )
      // Fetch all availability docs
      const availSnap = await getDocs(collection(db, 'doctorAvailability'))
      const availMap = {}
      availSnap.forEach(d => { availMap[d.id] = d.data() })

      const today = localToday()

      const list = docSnap.docs.map(d => {
        const data = d.data()
        const avail = availMap[d.id] ?? null
        const { slots: todaySlots } = getSlotsForDate({ ...data, availability: avail }, today)
        return {
          id: d.id,
          ...data,
          availability: avail,
          availableToday: todaySlots.length > 0,
        }
      })

      setDoctors(list)
    } catch (e) {
      console.error('loadDoctors:', e)
    }
    setLoadingDocs(false)
  }

  // ── Step 3: Load slots for selected doctor + date ─────────
  async function loadSlots(dateStr) {
    setSelectedDate(dateStr)
    setSelectedSlot('')
    setAllSlots([])
    setBookedSlots([])
    setSlotReason('')
    if (!dateStr || !selectedDoctor) return

    setLoadingSlots(true)
    try {
      const { slots, reason } = getSlotsForDate(selectedDoctor, dateStr)
      setSlotReason(reason)
      setAllSlots(slots)
    } catch (e) {
      console.error('loadSlots:', e)
    }
    setLoadingSlots(false)
  }

  // Real-time listener for booked slots
  useEffect(() => {
    if (!selectedDate || !selectedDoctor) return

    const q = query(
      collection(db, 'appointments'),
      where('doctorId', '==', selectedDoctor.id),
      where('date', '==', selectedDate)
    )

    const unsubscribe = onSnapshot(q, (snap) => {
      const taken = snap.docs
        .map(d => d.data())
        .filter(d => d.status !== 'Cancelled')
        .map(d => d.timeSlot)
        .filter(Boolean)
      setBookedSlots(taken)
    })

    return () => unsubscribe()
  }, [selectedDate, selectedDoctor])

  // ── Step 4: Book ──────────────────────────────────────────
  async function confirmBooking() {
    if (!reason.trim() || booking) return
    setBooking(true)
    try {
      // 1. Final Availability Check (Race Condition Prevention)
      const checkSnap = await getDocs(
        query(
          collection(db, 'appointments'),
          where('doctorId', '==', selectedDoctor.id),
          where('date', '==', selectedDate),
          where('timeSlot', '==', selectedSlot)
        )
      )

      const alreadyBooked = checkSnap.docs.some(d => d.data().status !== 'Cancelled')
      if (alreadyBooked) {
        alert('Sorry, this slot was just booked by someone else. Please choose another slot.')
        setStep(3) // Go back to slot selection
        setSelectedSlot('')
        setBooking(false)
        return
      }

      // 2. Proceed with booking
      await addDoc(collection(db, 'appointments'), {
        patientId: user.uid,
        patientName: user.displayName || user.email,
        doctorId: selectedDoctor.id,
        doctorName: selectedDoctor.name,
        department: specialization,
        date: selectedDate,
        timeSlot: selectedSlot,
        reason: reason.trim(),
        status: 'Scheduled',
        createdAt: new Date().toISOString(),
      })
      setSuccess(true)
    } catch (e) {
      console.error('confirmBooking:', e)
      alert('Booking failed. Please try again.')
    }
    setBooking(false)
  }

  function reset() {
    setStep(1); setSpecialization(''); setDoctors([])
    setSelectedDoctor(null); setSelectedDate(''); setAllSlots([])
    setBookedSlots([]); setSelectedSlot(''); setReason('')
    setSuccess(false); setSlotReason('')
  }

  // Derived
  const freeSlots = allSlots.filter(s => !bookedSlots.includes(s))
  const today = localToday()

  // ── Shared styles ─────────────────────────────────────────
  const S = {
    page: { padding: '2rem', maxWidth: '920px', margin: '0 auto' },
    card: { background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: '1.25rem' },
    btn: (color) => ({ background: color, color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 26px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem' }),
    back: { background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '8px', padding: '11px 20px', cursor: 'pointer', fontWeight: 600 },
    tag: (bg, color) => ({ background: bg, color, padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700 }),
    input: { width: '100%', padding: '11px 13px', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' },
  }

  // ─────────────────────────── SUCCESS ─────────────────────
  if (success) return (
    <div style={{ ...S.page, maxWidth: '500px', textAlign: 'center' }}>
      <div style={S.card}>
        <div style={{ fontSize: '4rem' }}>✅</div>
        <h2 style={{ color: '#16a34a' }}>Appointment Booked!</h2>
        <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '1rem', textAlign: 'left', marginBottom: '1.5rem' }}>
          {[
            ['Doctor', selectedDoctor?.name],
            ['Specialization', specialization],
            ['Date', selectedDate],
            ['Time', selectedSlot],
            ['Reason', reason],
          ].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', gap: '8px', marginBottom: '5px', fontSize: '0.9rem' }}>
              <span style={{ color: '#64748b', minWidth: '120px' }}>{l}:</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
        <button style={S.btn('#2563eb')} onClick={reset}>Book Another</button>
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <h1 style={{ margin: '0 0 4px' }}>📅 Book an Appointment</h1>
      <p style={{ color: '#64748b', margin: '0 0 1.5rem' }}>Follow the steps below</p>

      {/* Step bar */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '2rem' }}>
        {['Specialization', 'Doctor', 'Time Slot', 'Confirm'].map((s, i) => (
          <div key={i} style={{
            flex: 1, padding: '10px 4px', textAlign: 'center', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700,
            background: step === i + 1 ? '#2563eb' : step > i + 1 ? '#dcfce7' : '#f1f5f9',
            color: step === i + 1 ? '#fff' : step > i + 1 ? '#16a34a' : '#94a3b8',
          }}>
            {step > i + 1 ? '✓ ' : `${i + 1}. `}{s}
          </div>
        ))}
      </div>

      {/* ════════════ STEP 1 — Specialization ════════════ */}
      {step === 1 && (
        <>
          <h2 style={{ margin: '0 0 1rem' }}>Choose Specialization</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(145px,1fr))', gap: '1rem' }}>
            {SPECIALIZATIONS.map(s => (
              <div key={s.label}
                onClick={() => { setSpecialization(s.label); loadDoctors(s.label); setStep(2) }}
                style={{ ...S.card, marginBottom: 0, textAlign: 'center', cursor: 'pointer', padding: '1.4rem 1rem', border: '2px solid #e2e8f0', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none' }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{s.icon}</div>
                <strong style={{ fontSize: '0.9rem' }}>{s.label}</strong>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ════════════ STEP 2 — Choose Doctor ════════════ */}
      {step === 2 && (
        <>
          <h2 style={{ margin: '0 0 1rem' }}>
            Choose Doctor
            <span style={{ color: '#2563eb', fontWeight: 400, fontSize: '1rem', marginLeft: '8px' }}>— {specialization}</span>
          </h2>

          {loadingDocs ? (
            <div style={{ ...S.card, textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <p>Loading doctors...</p>
            </div>
          ) : doctors.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '3rem' }}>👨‍⚕️</div>
              <p>No doctors registered for <strong>{specialization}</strong> yet.</p>
              <p style={{ fontSize: '0.85rem' }}>Please choose a different specialization.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {doctors.map(doc => (
                <div key={doc.id} style={{ ...S.card, marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderLeft: `4px solid ${doc.availableToday ? '#16a34a' : '#f59e0b'}` }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
                    <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0, overflow: 'hidden' }}>
                      {doc.photoURL
                        ? <img src={doc.photoURL} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : '👨‍⚕️'}
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 3px', fontSize: '1rem' }}>{doc.name}</h3>
                      <p style={{ margin: '0 0 3px', color: '#64748b', fontSize: '0.85rem' }}>
                        {doc.specialization}
                        {doc.consultationDuration ? ` · ⏱️ ${doc.consultationDuration} min/slot` : ' · ⏱️ 30 min/slot'}
                      </p>
                      {doc.bio && <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem' }}>{doc.bio}</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <span style={S.tag(doc.availableToday ? '#dcfce7' : '#fef9c3', doc.availableToday ? '#16a34a' : '#ca8a04')}>
                      {doc.availableToday ? '✅ Available Today' : '🕐 Check Schedule'}
                    </span>
                    <button style={S.btn('#2563eb')}
                      onClick={() => { setSelectedDoctor(doc); setStep(3) }}>
                      Select →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button style={{ ...S.back, marginTop: '1.5rem' }}
            onClick={() => { setStep(1); setDoctors([]) }}>
            ← Back
          </button>
        </>
      )}

      {/* ════════════ STEP 3 — Select Slot ════════════ */}
      {step === 3 && selectedDoctor && (
        <>
          <h2 style={{ margin: '0 0 1rem' }}>Select Date & Time</h2>

          {/* Doctor info banner */}
          <div style={{ ...S.card, background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1rem 1.5rem', marginBottom: '1rem' }}>
            <strong>👨‍⚕️ {selectedDoctor.name}</strong>
            <span style={{ marginLeft: '10px', color: '#64748b', fontSize: '0.9rem' }}>
              {selectedDoctor.specialization} · {selectedDoctor.consultationDuration || 30} min per slot
            </span>
            {!selectedDoctor.availability && (
              <span style={{ marginLeft: '10px', ...S.tag('#dbeafe', '#1d4ed8') }}>
                Flexible — any date works
              </span>
            )}
          </div>

          {/* Date picker */}
          <div style={S.card}>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '8px' }}>
              📅 Pick a Date <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              min={today}
              onChange={e => loadSlots(e.target.value)}
              style={S.input}
            />
          </div>

          {/* Slots panel */}
          {selectedDate && (
            <div style={S.card}>
              {loadingSlots && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  <p>⏳ Loading slots...</p>
                </div>
              )}

              {!loadingSlots && slotReason === 'off' && (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div style={{ fontSize: '2.5rem' }}>🚫</div>
                  <h3 style={{ color: '#dc2626' }}>Doctor is on leave this day</h3>
                  <p style={{ color: '#64748b' }}>Please pick a different date.</p>
                </div>
              )}

              {!loadingSlots && slotReason === 'dayoff' && (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div style={{ fontSize: '2.5rem' }}>📅</div>
                  <h3 style={{ color: '#f59e0b' }}>Not a working day</h3>
                  <p style={{ color: '#64748b' }}>
                    Dr. {selectedDoctor.name} does not work on <strong>{dayNameFromDateStr(selectedDate)}s</strong>.
                    <br />Please choose another date.
                  </p>
                </div>
              )}

              {!loadingSlots && slotReason === 'ok' && allSlots.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  <p>No slots could be generated. Please try a different date.</p>
                </div>
              )}

              {!loadingSlots && slotReason === 'ok' && allSlots.length > 0 && freeSlots.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', background: '#fef2f2', borderRadius: '8px' }}>
                  <div style={{ fontSize: '2rem' }}>📵</div>
                  <p style={{ color: '#dc2626', fontWeight: 700 }}>All slots are fully booked!</p>
                  <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Please try a different date.</p>
                </div>
              )}

              {!loadingSlots && slotReason === 'ok' && freeSlots.length > 0 && (
                <>
                  {/* Summary badges */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '1.2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', flex: 1 }}>🕐 Available Slots</h3>
                    <span style={S.tag('#dcfce7', '#16a34a')}>{freeSlots.length} free</span>
                    {bookedSlots.length > 0 && <span style={S.tag('#fee2e2', '#dc2626')}>{bookedSlots.length} booked</span>}
                    <span style={S.tag('#f1f5f9', '#64748b')}>{allSlots.length} total</span>
                  </div>

                  {/* Morning slots */}
                  {allSlots.some(s => Number(s.split(':')[0]) < 12) && (
                    <div style={{ marginBottom: '1rem' }}>
                      <p style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>
                        🌅 Morning
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {allSlots
                          .filter(s => Number(s.split(':')[0]) < 12)
                          .filter(s => !bookedSlots.includes(s)) // 100% hidden if booked
                          .map(slot => {
                            const selected = selectedSlot === slot
                            return (
                              <button
                                key={slot}
                                onClick={() => setSelectedSlot(slot)}
                                style={{
                                  padding: '9px 16px',
                                  borderRadius: '8px',
                                  border: '2px solid',
                                  fontWeight: 700,
                                  fontSize: '0.9rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  borderColor: selected ? '#2563eb' : '#94a3b8',
                                  background: selected ? '#2563eb' : '#fff',
                                  color: selected ? '#fff' : '#1e293b',
                                }}
                              >
                                {slot}
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {/* Afternoon slots */}
                  {allSlots.some(s => Number(s.split(':')[0]) >= 12) && (
                    <div>
                      <p style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>
                        🌇 Afternoon
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {allSlots
                          .filter(s => Number(s.split(':')[0]) >= 12)
                          .filter(s => !bookedSlots.includes(s)) // 100% hidden if booked
                          .map(slot => {
                            const selected = selectedSlot === slot
                            return (
                              <button
                                key={slot}
                                onClick={() => setSelectedSlot(slot)}
                                style={{
                                  padding: '9px 16px',
                                  borderRadius: '8px',
                                  border: '2px solid',
                                  fontWeight: 700,
                                  fontSize: '0.9rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  borderColor: selected ? '#2563eb' : '#94a3b8',
                                  background: selected ? '#2563eb' : '#fff',
                                  color: selected ? '#fff' : '#1e293b',
                                }}
                              >
                                {slot}
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {/* Selected slot display */}
                  {selectedSlot && (
                    <div style={{ marginTop: '1.2rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.2rem' }}>⏰</span>
                      <span style={{ fontWeight: 700, color: '#1e40af' }}>Selected: {selectedSlot} on {selectedDate}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            {selectedSlot && (
              <button style={S.btn('#2563eb')} onClick={() => setStep(4)}>
                Next →
              </button>
            )}
            <button style={S.back}
              onClick={() => { setStep(2); setSelectedDate(''); setSelectedSlot(''); setAllSlots([]); setBookedSlots([]); setSlotReason('') }}>
              ← Back
            </button>
          </div>
        </>
      )}

      {/* ════════════ STEP 4 — Confirm ════════════ */}
      {step === 4 && (
        <>
          <h2 style={{ margin: '0 0 1rem' }}>Confirm Appointment</h2>
          <div style={S.card}>
            {/* Summary grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1.5rem' }}>
              {[
                ['👨‍⚕️ Doctor', selectedDoctor?.name],
                ['🏥 Specialization', specialization],
                ['📅 Date', selectedDate],
                ['⏰ Time Slot', selectedSlot],
              ].map(([label, value]) => (
                <div key={label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px' }}>
                  <p style={{ margin: '0 0 3px', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{label}</p>
                  <p style={{ margin: 0, fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Reason */}
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '8px', color: '#374151' }}>
              📝 Reason for Visit <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Describe your symptoms or reason for the visit..."
              rows={4}
              style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              onFocus={e => e.target.style.borderColor = '#2563eb'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={confirmBooking}
              disabled={!reason.trim() || booking}
              style={{
                ...S.btn(!reason.trim() || booking ? '#94a3b8' : '#16a34a'),
                cursor: !reason.trim() || booking ? 'not-allowed' : 'pointer',
              }}
            >
              {booking ? '⏳ Booking...' : '✅ Confirm Booking'}
            </button>
            <button style={S.back} onClick={() => setStep(3)}>← Back</button>
          </div>
        </>
      )}
    </div>
  )
}