import { useEffect, useState } from 'react'
import { db } from '../../firebase/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'

function DoctorDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ today: 0, week: 0, total: 0 })
  const [todayAppts, setTodayAppts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const today = new Date().toLocaleDateString('en-CA')
      const snap = await getDocs(query(collection(db, 'appointments'), where('doctorId', '==', user.uid)))
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const todayList = all.filter(a => a.date === today)
      setTodayAppts(todayList)
      setStats({ today: todayList.length, total: all.length })
      setLoading(false)
    }
    fetch()
  }, [user])

  const statusColor = { Scheduled: '#2563eb', Completed: '#16a34a', Cancelled: '#dc2626', Arrived: '#d97706', Waiting: '#7c3aed' }

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <h1>👨‍⚕️ Doctor Dashboard</h1>
      <p style={{ color: '#64748b' }}>📅 {new Date().toDateString()}</p>
      {loading ? <p>Loading...</p> : (
        <>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            {[{ label: "Today's Appointments", value: stats.today, color: '#2563eb' },
              { label: 'Total Appointments', value: stats.total, color: '#16a34a' }
            ].map((s, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px #0001', borderTop: `4px solid ${s.color}`, minWidth: '200px' }}>
                <h2 style={{ color: s.color, margin: 0 }}>{s.value}</h2>
                <p style={{ margin: '4px 0 0', color: '#64748b' }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px #0001' }}>
            <h2>📋 Today's Appointments</h2>
            {todayAppts.length === 0 ? <p style={{ color: '#94a3b8' }}>No appointments today.</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['#', 'Patient', 'Time', 'Reason', 'Status'].map(h => (
                      <th key={h} style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todayAppts.map((a, i) => (
                    <tr key={a.id}>
                      <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9' }}>{i + 1}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9' }}><strong>{a.patientName}</strong></td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9' }}>{a.timeSlot}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9' }}>{a.reason}</td>
                      <td style={{ padding: '10px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ background: statusColor[a.status] + '22', color: statusColor[a.status], padding: '3px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>{a.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default DoctorDashboard