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

function PatientDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const today = new Date().toISOString().split('T')[0]
      const apptSnap = await getDocs(query(collection(db, 'appointments'), where('patientId', '==', user.uid)))
      const appts = apptSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      appts.sort((a, b) => (a.date + a.timeSlot) > (b.date + b.timeSlot) ? 1 : -1)
      setAppointments(appts)

      const rxSnap = await getDocs(query(collection(db, 'prescriptions'), where('patientId', '==', user.uid)))
      const rxs = rxSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      rxs.sort((a, b) => b.uploadedAt > a.uploadedAt ? 1 : -1)
      setPrescriptions(rxs.slice(0, 3))
      setLoading(false)
    }
    fetchData()
  }, [user])

  const upcoming = appointments.filter(a => a.date >= new Date().toISOString().split('T')[0] && a.status !== 'Cancelled' && a.status !== 'Completed')
  const stats = [
    { icon: '📅', label: 'Upcoming', value: upcoming.length, color: '#2563eb', bg: '#eff6ff' },
    { icon: '✅', label: 'Completed', value: appointments.filter(a => a.status === 'Completed').length, color: '#16a34a', bg: '#dcfce7' },
    { icon: '💊', label: 'Prescriptions', value: prescriptions.length, color: '#7c3aed', bg: '#f3e8ff' },
  ]

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>👋 Welcome, {user.displayName || user.email.split('@')[0]}!</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>📅 {new Date().toDateString()}</p>
        </div>
        <button onClick={() => navigate('/patient/book')}
          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 24px', cursor: 'pointer', fontWeight: 700, fontSize: '1rem' }}>
          ➕ Book Appointment
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px #0001', borderTop: `4px solid ${s.color}` }}>
            <div style={{ background: s.bg, width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', marginBottom: '10px' }}>{s.icon}</div>
            <h2 style={{ margin: 0, color: s.color, fontSize: '1.8rem' }}>{loading ? '...' : s.value}</h2>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Upcoming Appointments */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px #0001' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>📅 Upcoming Appointments</h2>
            <button onClick={() => navigate('/patient/appointments')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>View All →</button>
          </div>
          {loading ? <p style={{ color: '#94a3b8' }}>Loading...</p> : upcoming.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
              <p>No upcoming appointments.</p>
              <button onClick={() => navigate('/patient/book')} style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '6px', padding: '6px 14px', cursor: 'pointer', fontWeight: 600 }}>Book Now</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {upcoming.slice(0, 4).map(a => (
                <div key={a.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{a.doctorName}</p>
                    <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '0.8rem' }}>{a.date} at {a.timeSlot}</p>
                    {a.waitingTime != null && a.status === 'Waiting' && (
                      <p style={{ margin: '2px 0 0', color: '#7c3aed', fontSize: '0.8rem', fontWeight: 600 }}>⏳ ~{a.waitingTime} min wait</p>
                    )}
                  </div>
                  <span style={{ background: STATUS_COLORS[a.status]?.bg, color: STATUS_COLORS[a.status]?.color, padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Prescriptions */}
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px #0001' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>💊 Recent Prescriptions</h2>
            <button onClick={() => navigate('/patient/prescriptions')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>View All →</button>
          </div>
          {loading ? <p style={{ color: '#94a3b8' }}>Loading...</p> : prescriptions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>
              <div style={{ fontSize: '2rem' }}>💊</div>
              <p style={{ fontSize: '0.9rem' }}>No prescriptions yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {prescriptions.map(rx => (
                <div key={rx.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>Dr. {rx.doctorName}</p>
                    <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '0.8rem' }}>{rx.uploadedAt?.split('T')[0]}</p>
                  </div>
                  {rx.fileURL && (
                    <a href={rx.fileURL} target="_blank" rel="noopener noreferrer"
                      style={{ background: '#eff6ff', color: '#2563eb', padding: '4px 10px', borderRadius: '6px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 600 }}>📥</a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PatientDashboard