import { useEffect, useState } from 'react'
import { db } from '../../firebase/firebase'
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore'

const STATUS_COLORS = { Scheduled: '#2563eb', Arrived: '#d97706', Waiting: '#7c3aed', 'In Consultation': '#0891b2', Completed: '#16a34a', Cancelled: '#dc2626' }

function ReceptionAppointments() {
  const [appointments, setAppointments] = useState([])
  const [doctors, setDoctors] = useState({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [filterStatus, setFilterStatus] = useState('All')

  const fetchAll = async () => {
    setLoading(true)
    const snap = await getDocs(collection(db, 'appointments'))
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.timeSlot > b.timeSlot ? 1 : -1)
    setAppointments(all)
    const dSnap = await getDocs(collection(db, 'doctors'))
    const dm = {}; dSnap.docs.forEach(d => { dm[d.id] = d.data() })
    setDoctors(dm)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const handleArrived = async (appt) => {
    const sameDocAppts = appointments.filter(a => a.doctorId === appt.doctorId && a.date === appt.date && ['Arrived', 'Waiting', 'In Consultation'].includes(a.status))
    const queuePosition = sameDocAppts.length
    const duration = doctors[appt.doctorId]?.consultationDuration || 30
    const waitingTime = queuePosition * duration
    await updateDoc(doc(db, 'appointments', appt.id), { status: 'Waiting', arrivedAt: new Date().toISOString(), waitingTime, queuePosition })
    fetchAll()
  }

  const handleStatusChange = async (id, status) => {
    await updateDoc(doc(db, 'appointments', id), { status })
    fetchAll()
  }

  const filtered = appointments.filter(a => {
    const matchSearch = !search || a.patientName?.toLowerCase().includes(search.toLowerCase()) || a.doctorName?.toLowerCase().includes(search.toLowerCase())
    const matchDate = !filterDate || a.date === filterDate
    const matchStatus = filterStatus === 'All' || a.status === filterStatus
    return matchSearch && matchDate && matchStatus
  })

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🗂️ All Appointments</h1>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', background: '#fff', padding: '1rem', borderRadius: '10px', boxShadow: '0 2px 8px #0001' }}>
        <input placeholder="🔍 Search patient or doctor..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 2, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', minWidth: '200px' }} />
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          {['All', 'Scheduled', 'Arrived', 'Waiting', 'In Consultation', 'Completed', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={() => { setFilterDate(''); setSearch(''); setFilterStatus('All') }}
          style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer' }}>Clear</button>
      </div>
      {loading ? <p>Loading...</p> : (
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px #0001', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['#', 'Patient', 'Doctor', 'Date', 'Time', 'Reason', 'Status', 'Wait', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '0.85rem', color: '#64748b' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No appointments found.</td></tr>
              ) : filtered.map((a, i) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px' }}>{i + 1}</td>
                  <td style={{ padding: '12px' }}><strong>{a.patientName}</strong></td>
                  <td style={{ padding: '12px' }}>{a.doctorName}</td>
                  <td style={{ padding: '12px' }}>{a.date}</td>
                  <td style={{ padding: '12px' }}>{a.timeSlot}</td>
                  <td style={{ padding: '12px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.reason}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ background: (STATUS_COLORS[a.status] || '#94a3b8') + '22', color: STATUS_COLORS[a.status] || '#94a3b8', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {a.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#7c3aed', fontSize: '0.85rem' }}>
                    {a.waitingTime != null ? `⏳ ~${a.waitingTime} min` : '—'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {a.status === 'Scheduled' && (
                        <button onClick={() => handleArrived(a)}
                          style={{ background: '#fef9c3', color: '#ca8a04', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                          ✅ Arrived
                        </button>
                      )}
                      {a.status === 'Waiting' && (
                        <button onClick={() => handleStatusChange(a.id, 'In Consultation')}
                          style={{ background: '#e0f2fe', color: '#0891b2', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                          🩺 Start
                        </button>
                      )}
                      {a.status === 'In Consultation' && (
                        <button onClick={() => handleStatusChange(a.id, 'Completed')}
                          style={{ background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                          ✅ Done
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ReceptionAppointments