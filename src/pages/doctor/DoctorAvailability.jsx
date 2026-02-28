import { useEffect, useState } from 'react'
import { db } from '../../firebase/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

// Smart default: Mon–Fri 9 AM–5 PM pre-checked
const DEFAULT_WORKING_DAYS = {
  Monday:    { start: '09:00', end: '17:00' },
  Tuesday:   { start: '09:00', end: '17:00' },
  Wednesday: { start: '09:00', end: '17:00' },
  Thursday:  { start: '09:00', end: '17:00' },
  Friday:    { start: '09:00', end: '17:00' },
}

function DoctorAvailability() {
  const { user } = useAuth()
  const [workingDays, setWorkingDays] = useState(DEFAULT_WORKING_DAYS)
  const [offDates, setOffDates]       = useState([])
  const [newOffDate, setNewOffDate]   = useState('')
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    const fetchAvailability = async () => {
      const snap = await getDoc(doc(db, 'doctorAvailability', user.uid))
      if (snap.exists()) {
        setWorkingDays(snap.data().workingDays || DEFAULT_WORKING_DAYS)
        setOffDates(snap.data().offDates || [])
      }
      // else: new doctor → keep defaults pre-filled
      setLoading(false)
    }
    fetchAvailability()
  }, [user])

  const toggleDay = (day) => {
    setWorkingDays(prev => {
      if (prev[day]) {
        const n = { ...prev }
        delete n[day]
        return n
      }
      return { ...prev, [day]: { start: '09:00', end: '17:00' } }
    })
  }

  const updateTime = (day, field, val) => {
    setWorkingDays(prev => ({ ...prev, [day]: { ...prev[day], [field]: val } }))
  }

  const addOffDate = () => {
    if (newOffDate && !offDates.includes(newOffDate)) {
      setOffDates(prev => [...prev, newOffDate].sort())
      setNewOffDate('')
    }
  }

  const removeOffDate = (d) => setOffDates(prev => prev.filter(x => x !== d))

  const handleSave = async () => {
    setSaving(true)
    await setDoc(doc(db, 'doctorAvailability', user.uid), {
      workingDays,
      offDates,
      updatedAt: new Date().toISOString(),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const totalSlots = (day) => {
    const d = workingDays[day]
    if (!d) return 0
    const [sh, sm] = d.start.split(':').map(Number)
    const [eh, em] = d.end.split(':').map(Number)
    return Math.floor((eh * 60 + em - (sh * 60 + sm)) / 30)
  }

  if (loading) return (
    <div style={{ padding: '2rem', color: '#94a3b8', textAlign: 'center' }}>Loading availability...</div>
  )

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 4px' }}>🗓️ Manage Availability</h1>
      <p style={{ color: '#64748b', margin: '0 0 1.5rem' }}>
        Set your working hours so patients can book appointments with you.
      </p>

      {/* Info banner */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 16px', marginBottom: '1.5rem', fontSize: '0.9rem', color: '#1e40af' }}>
        ℹ�� Patients can book appointments even without a schedule set — default hours (9 AM–5 PM, Mon–Fri) will be used. Set your custom schedule to override.
      </div>

      {/* Working Days */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#374151' }}>
          📅 Working Days & Hours
        </h2>

        {DAYS.map(day => {
          const isWorking  = !!workingDays[day]
          const slotsCount = totalSlots(day)
          return (
            <div key={day} style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              marginBottom: '10px', flexWrap: 'wrap',
              padding: '10px 14px', borderRadius: '8px',
              background: isWorking ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${isWorking ? '#86efac' : '#e2e8f0'}`,
              transition: 'all 0.2s',
            }}>
              {/* Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '130px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox" checked={isWorking}
                  onChange={() => toggleDay(day)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563eb' }}
                />
                <span style={{ fontWeight: isWorking ? 700 : 400, color: isWorking ? '#15803d' : '#94a3b8', fontSize: '0.95rem' }}>
                  {day}
                </span>
              </label>

              {isWorking ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>From</span>
                    <input type="time" value={workingDays[day].start}
                      onChange={e => updateTime(day, 'start', e.target.value)}
                      style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.9rem' }}
                    />
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>To</span>
                    <input type="time" value={workingDays[day].end}
                      onChange={e => updateTime(day, 'end', e.target.value)}
                      style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.9rem' }}
                    />
                  </div>
                  <span style={{ background: '#dcfce7', color: '#16a34a', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 600, marginLeft: 'auto' }}>
                    ~{slotsCount} slots/day
                  </span>
                </>
              ) : (
                <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontStyle: 'italic' }}>Day off</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Off Dates */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#374151' }}>🚫 Leave / Off Dates</h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 12px' }}>
          Add specific dates when you will NOT be available (holidays, leave, etc.)
        </p>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input type="date" value={newOffDate}
            min={new Date().toLocaleDateString('en-CA')}
            onChange={e => setNewOffDate(e.target.value)}
            style={{ padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', flex: 1, minWidth: '160px', fontSize: '0.95rem' }}
          />
          <button onClick={addOffDate} disabled={!newOffDate}
            style={{ background: newOffDate ? '#dc2626' : '#e2e8f0', color: newOffDate ? '#fff' : '#94a3b8', border: 'none', borderRadius: '8px', padding: '9px 20px', cursor: newOffDate ? 'pointer' : 'not-allowed', fontWeight: 600, transition: 'all 0.2s' }}>
            + Add Off Date
          </button>
        </div>
        {offDates.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>No off dates added.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {offDates.map(d => (
              <span key={d} style={{ background: '#fee2e2', color: '#dc2626', padding: '5px 12px', borderRadius: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                {d}
                <button onClick={() => removeOffDate(d)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1rem', padding: '0', lineHeight: 1, fontWeight: 700 }}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Save Button */}
      <button onClick={handleSave} disabled={saving}
        style={{
          background: saved ? '#16a34a' : '#2563eb',
          color: '#fff', border: 'none', borderRadius: '8px',
          padding: '13px 36px', cursor: 'pointer', fontWeight: 700,
          fontSize: '1rem', transition: 'all 0.3s',
          boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
        }}>
        {saving ? '⏳ Saving...' : saved ? '✅ Saved Successfully!' : '💾 Save Availability'}
      </button>
    </div>
  )
}

export default DoctorAvailability