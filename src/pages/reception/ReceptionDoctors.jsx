import { useEffect, useState } from 'react'
import { db } from '../../firebase/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function ReceptionDoctors() {
  const [doctors, setDoctors] = useState([])
  const [availability, setAvailability] = useState({})
  const [todayAppts, setTodayAppts] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchAll = async () => {
      const today = new Date().toISOString().split('T')[0]
      const todayDay = DAY_NAMES[new Date().getDay()]

      const dSnap = await getDocs(collection(db, 'doctors'))
      const docs = dSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setDoctors(docs)

      const availSnap = await getDocs(collection(db, 'doctorAvailability'))
      const availMap = {}
      availSnap.docs.forEach(d => { availMap[d.id] = d.data() })
      setAvailability(availMap)

      const apptSnap = await getDocs(collection(db, 'appointments'))
      const apptMap = {}
      apptSnap.docs.forEach(d => {
        const data = d.data()
        if (data.date === today) {
          if (!apptMap[data.doctorId]) apptMap[data.doctorId] = []
          apptMap[data.doctorId].push(data)
        }
      })
      setTodayAppts(apptMap)
      setLoading(false)
    }
    fetchAll()
  }, [])

  const isAvailableToday = (doctorId) => {
    const avail = availability[doctorId]
    if (!avail) return false
    const today = new Date().toISOString().split('T')[0]
    if (avail.offDates?.includes(today)) return false
    const todayDay = DAY_NAMES[new Date().getDay()]
    return !!avail.workingDays?.[todayDay]
  }

  const getTodayHours = (doctorId) => {
    const avail = availability[doctorId]
    if (!avail) return null
    const todayDay = DAY_NAMES[new Date().getDay()]
    return avail.workingDays?.[todayDay] || null
  }

  const filtered = doctors.filter(d => !search || d.name?.toLowerCase().includes(search.toLowerCase()) || d.specialization?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <h1>👨‍⚕️ Doctors</h1>
      <p style={{ color: '#64748b' }}>All registered doctors and today's schedule</p>

      <input
        placeholder="🔍 Search by name or specialization..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
      />

      {loading ? <p style={{ color: '#94a3b8' }}>Loading doctors...</p> : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '3rem', textAlign: 'center', boxShadow: '0 2px 8px #0001', color: '#94a3b8' }}>
          <div style={{ fontSize: '3rem' }}>👨‍⚕️</div>
          <p>No doctors found.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {filtered.map(doctor => {
            const available = isAvailableToday(doctor.id)
            const hours = getTodayHours(doctor.id)
            const appts = todayAppts[doctor.id] || []
            const waiting = appts.filter(a => ['Arrived', 'Waiting', 'In Consultation'].includes(a.status)).length
            const completed = appts.filter(a => a.status === 'Completed').length

            return (
              <div key={doctor.id} style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px #0001', borderTop: `4px solid ${available ? '#16a34a' : '#94a3b8'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {doctor.photoURL ? <img src={doctor.photoURL} alt={doctor.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '1.8rem' }}>👨‍⚕️</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{doctor.name || 'Unknown Doctor'}</h3>
                    <p style={{ margin: '2px 0', color: '#64748b', fontSize: '0.85rem' }}>{doctor.specialization}</p>
                    <span style={{ background: available ? '#dcfce7' : '#fee2e2', color: available ? '#16a34a' : '#dc2626', padding: '2px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>
                      {available ? '✅ Available Today' : '❌ Not Available'}
                    </span>
                  </div>
                </div>

                {available && hours && (
                  <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px 12px', marginBottom: '10px', fontSize: '0.85rem', color: '#475569' }}>
                    🕐 Today: {hours.start} – {hours.end} &nbsp;|&nbsp; ⏱️ {doctor.consultationDuration || 30} min/slot
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                    📅 {appts.length} appts today
                  </span>
                  {waiting > 0 && (
                    <span style={{ background: '#f3e8ff', color: '#7c3aed', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                      ⏳ {waiting} waiting
                    </span>
                  )}
                  {completed > 0 && (
                    <span style={{ background: '#dcfce7', color: '#16a34a', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                      ✅ {completed} done
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ReceptionDoctors