import { useEffect, useState } from 'react'
import { db } from '../../firebase/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'

function ReceptionDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ total: 0, scheduled: 0, arrived: 0, waiting: 0, inConsultation: 0, completed: 0, cancelled: 0 })
  const [todayAppts, setTodayAppts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const today = new Date().toISOString().split('T')[0]
      const snap = await getDocs(collection(db, 'appointments'))
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const todayList = all.filter(a => a.date === today)
      todayList.sort((a, b) => a.timeSlot > b.timeSlot ? 1 : -1)
      setTodayAppts(todayList)
      setStats({
        total: todayList.length,
        scheduled: todayList.filter(a => a.status === 'Scheduled').length,
        arrived: todayList.filter(a => a.status === 'Arrived').length,
        waiting: todayList.filter(a => a.status === 'Waiting').length,
        inConsultation: todayList.filter(a => a.status === 'In Consultation').length,
        completed: todayList.filter(a => a.status === 'Completed').length,
        cancelled: todayList.filter(a => a.status === 'Cancelled').length,
      })
      setLoading(false)
    }
    fetch()
  }, [])

  const statCards = [
    { label: "Today's Total", value: stats.total, color: '#2563eb', bg: '#eff6ff', icon: '📅' },
    { label: 'Scheduled', value: stats.scheduled, color: '#2563eb', bg: '#eff6ff', icon: '🗓️' },
    { label: 'Arrived', value: stats.arrived, color: '#ca8a04', bg: '#fef9c3', icon: '🚶' },
    { label: 'Waiting', value: stats.waiting, color: '#7c3aed', bg: '#f3e8ff', icon: '⏳' },
    { label: 'In Consultation', value: stats.inConsultation, color: '#0891b2', bg: '#e0f2fe', icon: '🩺' },
    { label: 'Completed', value: stats.completed, color: '#16a34a', bg: '#dcfce7', icon: '✅' },
  ]

  const STATUS_COLORS = {
    Scheduled: { bg: '#eff6ff', color: '#2563eb' },
    Completed: { bg: '#dcfce7', color: '#16a34a' },
    Cancelled: { bg: '#fee2e2', color: '#dc2626' },
    Arrived: { bg: '#fef9c3', color: '#ca8a04' },
    Waiting: { bg: '#f3e8ff', color: '#7c3aed' },
    'In Consultation': { bg: '#e0f2fe', color: '#0891b2' },
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>🗂️ Reception Dashboard</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>📅 {new Date().toDateString()}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/reception/appointments')}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontWeight: 600 }}>
            📋 All Appointments
          </button>
          <button onClick={() => navigate('/reception/doctors')}
            style={{ background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontWeight: 600 }}>
            👨‍⚕️ Doctors
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {statCards.map((s, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 8px #0001', borderTop: `4px solid ${s.color}`, cursor: 'default' }}>
            <div style={{ background: s.bg, width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', marginBottom: '8px' }}>{s.icon}</div>
            <h2 style={{ margin: 0, fontSize: '1.8rem', color: s.color }}>{loading ? '...' : s.value}</h2>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.85rem' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Today's Queue */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px #0001' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>🕐 Today's Queue</h2>
          <button onClick={() => navigate('/reception/appointments')} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}>Manage All →</button>
        </div>
        {loading ? <p style={{ color: '#94a3b8' }}>Loading...</p> : todayAppts.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '1.5rem' }}>No appointments today.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todayAppts.map((a, i) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem', minWidth: '20px' }}>#{i + 1}</span>
                <span style={{ fontWeight: 600, flex: 1, minWidth: '100px' }}>{a.patientName}</span>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>→ {a.doctorName}</span>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>⏰ {a.timeSlot}</span>
                {a.waitingTime != null && <span style={{ color: '#7c3aed', fontSize: '0.8rem', fontWeight: 600 }}>⏳ ~{a.waitingTime}m</span>}
                <span style={{ background: STATUS_COLORS[a.status]?.bg, color: STATUS_COLORS[a.status]?.color, padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ReceptionDashboard