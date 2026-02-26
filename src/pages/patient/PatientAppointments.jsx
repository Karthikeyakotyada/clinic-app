import { useEffect, useState } from 'react'
import { db } from '../../firebase/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const STATUS_COLORS = {
  Scheduled: { bg: '#eff6ff', color: '#2563eb' },
  Completed: { bg: '#dcfce7', color: '#16a34a' },
  Cancelled: { bg: '#fee2e2', color: '#dc2626' },
  Arrived: { bg: '#fef9c3', color: '#ca8a04' },
  Waiting: { bg: '#f3e8ff', color: '#7c3aed' },
  'In Consultation': { bg: '#e0f2fe', color: '#0891b2' },
}

function PatientAppointments() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('All')

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(query(collection(db, 'appointments'), where('patientId', '==', user.uid)))
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      data.sort((a, b) => (a.date + a.timeSlot) > (b.date + b.timeSlot) ? -1 : 1)
      setAppointments(data)
      setLoading(false)
    }
    fetch()
  }, [user])

  const filtered = filterStatus === 'All' ? appointments : appointments.filter(a => a.status === filterStatus)

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>📅 My Appointments</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>Track all your appointments</p>
        </div>
        <button onClick={() => navigate('/patient/book')}
          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}>
          ➕ Book New
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['All', 'Scheduled', 'Arrived', 'Waiting', 'In Consultation', 'Completed', 'Cancelled'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{ padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', background: filterStatus === s ? '#2563eb' : '#f1f5f9', color: filterStatus === s ? '#fff' : '#64748b', transition: 'all 0.2s' }}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading appointments...</p>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '3rem', textAlign: 'center', boxShadow: '0 2px 8px #0001', color: '#94a3b8' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
          <p>No {filterStatus !== 'All' ? filterStatus.toLowerCase() : ''} appointments found.</p>
          <button onClick={() => navigate('/patient/book')}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', marginTop: '1rem', fontWeight: 600 }}>
            Book an Appointment
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map(appt => (
            <div key={appt.id} style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem 1.5rem', boxShadow: '0 2px 8px #0001', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderLeft: `4px solid ${STATUS_COLORS[appt.status]?.color || '#94a3b8'}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '1rem' }}>👨‍⚕️ {appt.doctorName}</strong>
                  <span style={{ background: STATUS_COLORS[appt.status]?.bg, color: STATUS_COLORS[appt.status]?.color, padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>{appt.status}</span>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', color: '#64748b', fontSize: '0.9rem' }}>
                  <span>🏥 {appt.department}</span>
                  <span>📅 {appt.date}</span>
                  <span>⏰ {appt.timeSlot}</span>
                  <span>📝 {appt.reason}</span>
                </div>
                {appt.status === 'Waiting' && appt.waitingTime != null && (
                  <div style={{ marginTop: '10px', background: '#f3e8ff', color: '#7c3aed', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', display: 'inline-block' }}>
                    ⏳ Estimated Waiting Time: ~{appt.waitingTime} minutes
                  </div>
                )}
                {appt.status === 'In Consultation' && (
                  <div style={{ marginTop: '10px', background: '#e0f2fe', color: '#0891b2', padding: '8px 14px', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', display: 'inline-block' }}>
                    🩺 You are currently in consultation
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PatientAppointments