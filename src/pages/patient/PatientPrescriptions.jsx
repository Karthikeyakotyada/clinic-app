import { useEffect, useState } from 'react'
import { db } from '../../firebase/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'

function PatientPrescriptions() {
  const { user } = useAuth()
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(query(collection(db, 'prescriptions'), where('patientId', '==', user.uid)))
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      data.sort((a, b) => b.uploadedAt > a.uploadedAt ? 1 : -1)
      setPrescriptions(data)
      setLoading(false)
    }
    fetch()
  }, [user])

  const filtered = prescriptions.filter(rx =>
    !search || rx.doctorName?.toLowerCase().includes(search.toLowerCase()) || rx.notes?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1>💊 My Prescriptions</h1>
      <p style={{ color: '#64748b' }}>All prescriptions uploaded by your doctors</p>

      <input
        placeholder="🔍 Search by doctor or notes..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '1rem', boxSizing: 'border-box' }}
      />

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading prescriptions...</p>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '3rem', textAlign: 'center', boxShadow: '0 2px 8px #0001', color: '#94a3b8' }}>
          <div style={{ fontSize: '3rem' }}>💊</div>
          <p>No prescriptions found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map(rx => (
            <div key={rx.id} style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px #0001', borderLeft: '4px solid #7c3aed' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '1rem' }}>👨‍⚕️ {rx.doctorName}</strong>
                    <span style={{ background: '#f3e8ff', color: '#7c3aed', padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600 }}>Prescription</span>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>📅 {rx.uploadedAt?.split('T')[0]}</span>
                  </div>
                  <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', borderLeft: '3px solid #e2e8f0' }}>
                    <p style={{ margin: 0, color: '#374151', whiteSpace: 'pre-wrap', fontSize: '0.95rem', lineHeight: 1.6 }}>{rx.notes}</p>
                  </div>
                </div>
                {rx.fileURL && (
                  <a href={rx.fileURL} target="_blank" rel="noopener noreferrer"
                    style={{ background: '#eff6ff', color: '#2563eb', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    📥 Download {rx.fileName ? `(${rx.fileName})` : 'File'}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PatientPrescriptions