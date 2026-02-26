import { useEffect, useState } from 'react'
import { db } from '../../firebase/firebase'
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'

const STATUS_COLORS = {
  Scheduled: { bg: '#eff6ff', color: '#2563eb' },
  Completed: { bg: '#dcfce7', color: '#16a34a' },
  Cancelled: { bg: '#fee2e2', color: '#dc2626' },
  Arrived: { bg: '#fef9c3', color: '#ca8a04' },
  Waiting: { bg: '#f3e8ff', color: '#7c3aed' },
  'In Consultation': { bg: '#e0f2fe', color: '#0891b2' },
}

function DoctorAppointments() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('All')
  const [search, setSearch] = useState('')

  const fetchAppointments = async () => {
    setLoading(true)
    const snap = await getDocs(query(collection(db, 'appointments'), where('doctorId', '==', user.uid)))
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    data.sort((a, b) => (a.date + a.timeSlot) > (b.date + b.timeSlot) ? 1 : -1)
    setAppointments(data)
    setLoading(false)
  }

  useEffect(() => { fetchAppointments() }, [user])

  const handleStatusChange = async (id, status) => {
    await updateDoc(doc(db, 'appointments', id), { status })
    fetchAppointments()
  }

  const counts = {
    All: appointments.length,
    Scheduled: appointments.filter(a => a.status === 'Scheduled').length,
    Completed: appointments.filter(a => a.status === 'Completed').length,
    Cancelled: appointments.filter(a => a.status === 'Cancelled').length,
  }

  const filtered = appointments.filter(a => {
    const matchSearch = !search ||
      a.patientName?.toLowerCase().includes(search.toLowerCase()) ||
      a.reason?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'All' || a.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>📅 My Appointments</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>All your patient appointments</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {Object.entries(counts).map(([key, val]) => (
          <div key={key} onClick={() => setFilterStatus(key)}
            style={{ background: filterStatus === key ? '#2563eb' : '#fff', color: filterStatus === key ? '#fff' : '#334155', borderRadius: '10px', padding: '1rem 1.5rem', cursor: 'pointer', boxShadow: '0 2px 8px #0001', transition: 'all 0.2s', minWidth: '130px' }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem' }}>{val}</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8 }}>{key}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          placeholder="🔍 Search by patient name or reason..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }}
        />
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px #0001', overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Loading appointments...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '3rem' }}>📭</div>
            <p>No appointments found.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['#', '👤 Patient', '📅 Date', '⏰ Time', '📝 Reason', '📋 Status', '⚡ Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((appt, i) => (
                <tr key={appt.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px' }}>{i + 1}</td>
                  <td style={{ padding: '12px 16px' }}><strong>{appt.patientName}</strong></td>
                  <td style={{ padding: '12px 16px' }}>{appt.date}</td>
                  <td style={{ padding: '12px 16px' }}>{appt.timeSlot}</td>
                  <td style={{ padding: '12px 16px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.reason}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: STATUS_COLORS[appt.status]?.bg || '#f1f5f9',
                      color: STATUS_COLORS[appt.status]?.color || '#64748b',
                      padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap'
                    }}>{appt.status}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select
                      value={appt.status}
                      onChange={e => handleStatusChange(appt.id, e.target.value)}
                      style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default DoctorAppointments