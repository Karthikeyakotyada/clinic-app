import { useEffect, useState } from 'react'
import { db, storage } from '../../firebase/firebase'
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { ref, getBlob } from 'firebase/storage'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { useAuth } from '../../context/AuthContext'

const STATUS_COLORS = {
  Scheduled: { bg: '#eff6ff', color: '#2563eb' },
  Completed: { bg: '#dcfce7', color: '#16a34a' },
  Cancelled: { bg: '#fee2e2', color: '#dc2626' },
  Arrived: { bg: '#fef9c3', color: '#ca8a04' },
  Waiting: { bg: '#f3e8ff', color: '#7c3aed' },
  'In Consultation': { bg: '#e0f2fe', color: '#0891b2' },
}

const TYPE_ICONS = {
  'Blood Test': '🩸', 'X-Ray': '🦴', 'MRI / CT Scan': '🧠', 'ECG': '❤️',
  'Ultra Sound': '🔊', 'Prescription': '💊', 'Vaccination Record': '💉',
  'Discharge Summary': '📋', 'Other': '📄',
}

const localToday = () => {
  const n = new Date()
  return [
    n.getFullYear(),
    String(n.getMonth() + 1).padStart(2, '0'),
    String(n.getDate()).padStart(2, '0'),
  ].join('-')
}

function DoctorAppointments() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('All')
  const [search, setSearch] = useState('')
  const [cancellingAll, setCancellingAll] = useState(false)

  // Medical Records Modal State
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [patientRecords, setPatientRecords] = useState([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [analyzingRecordId, setAnalyzingRecordId] = useState(null)

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

  const handleEmergencyCancel = async () => {
    const today = localToday()
    const todayAppts = appointments.filter(a => a.date === today && a.status !== 'Cancelled' && a.status !== 'Completed')

    if (todayAppts.length === 0) {
      alert('No active appointments found for today.')
      return
    }

    const confirm = window.confirm(`⚠️ EMERGENCY ACTION: This will cancel all ${todayAppts.length} active appointments for today (${today}). Are you sure?`)
    if (!confirm) return

    setCancellingAll(true)
    try {
      const { writeBatch } = await import('firebase/firestore')
      const batch = writeBatch(db)
      todayAppts.forEach(a => {
        batch.update(doc(db, 'appointments', a.id), { status: 'Cancelled' })
      })
      await batch.commit()
      alert(`Successfully cancelled ${todayAppts.length} appointments.`)
      fetchAppointments()
    } catch (err) {
      console.error(err)
      alert('Failed to batch cancel appointments.')
    }
    setCancellingAll(false)
  }

  const handleViewRecords = async (patientId, patientName) => {
    setSelectedPatient({ id: patientId, name: patientName })
    setRecordsLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'medicalRecords'), where('patientId', '==', patientId)))
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      records.sort((a, b) => b.uploadedAt > a.uploadedAt ? 1 : -1)
      setPatientRecords(records)
    } catch (err) {
      console.error(err)
      alert('Failed to load records. Check permissions or network.')
    }
    setRecordsLoading(false)
  }

  const handleAnalyzeRecord = async (record) => {
    // 0. Validate API Key
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    if (!API_KEY || API_KEY.includes('YOUR_')) {
      alert('Gemini API Key is missing or invalid. Please check your .env file.');
      return;
    }

    setAnalyzingRecordId(record.id)
    try {
      // 1. Fetch File Blob
      let blob;
      try {
        // Method A: Official Storage SDK (Handles auth/headers)
        const storageRef = ref(storage, record.fileURL);
        blob = await getBlob(storageRef);
      } catch (storageErr) {
        console.warn('Storage SDK fetch failed, trying proxy...', storageErr);
        // Method B: Robust Proxy Fallback (Bypasses CORS entirely)
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(record.fileURL)}`;
        const proxyRes = await fetch(proxyUrl);
        if (!proxyRes.ok) throw new Error('Failed to fetch file via Storage SDK and Proxy');
        blob = await proxyRes.blob();
      }

      // 2. Convert to Base64
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(blob)
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
      })

      // 3. Initialize Gemini
      const genAI = new GoogleGenerativeAI(API_KEY)
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        apiVersion: 'v1'
      })

      const prompt = `Analyze this medical record/document. 
      Identify the patient (if visible), the date, and summarize the key findings, 
      diagnoses, or test results in a clear, bulleted format for a doctor to review quickly.`

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: base64Data, mimeType: blob.type || 'image/jpeg' } }
      ])

      const summary = result.response.text()

      // 4. Save to Firestore
      await updateDoc(doc(db, 'medicalRecords', record.id), {
        aiSummary: summary,
        analyzedAt: new Date().toISOString()
      })

      alert('Analysis complete! Check the record details.')
    } catch (err) {
      console.error('AI Analysis Error:', err)
      alert(`Failed to analyze record: ${err.message}. If it's a CORS error, please ensure your Firebase Storage CORS is configured.`);
    }
    setAnalyzingRecordId(null)
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
        <button
          onClick={handleEmergencyCancel}
          disabled={cancellingAll}
          style={{
            background: '#fee2e2', color: '#dc2626', border: '2px solid #fecaca',
            padding: '10px 18px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 800,
            cursor: cancellingAll ? 'wait' : 'pointer', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 6px #dc262611'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.transform = 'none' }}
        >
          {cancellingAll ? '⏳ Cancelling...' : '🚨 Emergency: Cancel All Today'}
        </button>
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
                  <td style={{ padding: '12px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      value={appt.status}
                      onChange={e => handleStatusChange(appt.id, e.target.value)}
                      style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                    <button
                      onClick={() => handleViewRecords(appt.patientId, appt.patientName)}
                      style={{
                        background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
                        padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700,
                        cursor: 'pointer', whiteSpace: 'nowrap'
                      }}>
                      🗂️ View Records
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Patient Records Modal ── */}
      {selectedPatient && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#fff', width: '100%', maxWidth: '700px', borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            display: 'flex', flexDirection: 'column', maxHeight: '90vh'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.2rem 1.5rem', borderBottom: '1px solid #f1f5f9',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#f8fafc', borderRadius: '16px 16px 0 0'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>🗂️ Medical Records</h2>
                <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '0.85rem' }}>Patient: <strong>{selectedPatient.name}</strong></p>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                style={{ background: '#f1f5f9', border: 'none', color: '#64748b', fontSize: '1.2rem', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer' }}>
                ✖
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
              {recordsLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>⏳ Fetching records...</div>
              ) : patientRecords.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📄</div>
                  <p>No medical records found for this patient.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {patientRecords.map(r => (
                    <div key={r.id} style={{
                      display: 'flex', flexDirection: 'column', gap: '14px',
                      padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        <div style={{ width: '40px', height: '40px', background: '#eff6ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                          {TYPE_ICONS[r.recordType] || '📄'}
                        </div>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <p style={{ margin: 0, fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>{r.recordType}</p>
                          <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '0.8rem' }}>
                            {r.fileName} {r.recordDate && ` · 📅 ${r.recordDate}`}
                          </p>
                          {r.notes && <p style={{ margin: '4px 0 0', color: '#475569', fontSize: '0.85rem', fontStyle: 'italic' }}>"{r.notes}"</p>}
                          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.7rem' }}>Uploaded: {new Date(r.uploadedAt).toLocaleDateString()}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                          {!r.aiSummary && (
                            <button
                              onClick={() => handleAnalyzeRecord(r)}
                              disabled={analyzingRecordId === r.id}
                              style={{
                                background: '#fdf4ff', color: '#c026d3', border: '1px solid #f0abfc', padding: '8px 16px', borderRadius: '8px',
                                fontSize: '0.85rem', fontWeight: 600, cursor: analyzingRecordId === r.id ? 'wait' : 'pointer', transition: 'all 0.2s', opacity: analyzingRecordId === r.id ? 0.7 : 1
                              }}>
                              {analyzingRecordId === r.id ? '⏳ Analyzing...' : '✨ Analyze with AI'}
                            </button>
                          )}
                          <a href={r.fileURL} target="_blank" rel="noopener noreferrer"
                            style={{
                              background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '8px',
                              textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600, display: 'inline-block'
                            }}>
                            📥 Open File
                          </a>
                        </div>
                      </div>

                      {/* AI Summary Section */}
                      {r.aiSummary && (
                        <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#fdf4ff', border: '1px solid #f5d0fe', borderRadius: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '1.2rem' }}>✨</span>
                            <h4 style={{ margin: 0, color: '#86198f', fontSize: '0.9rem' }}>AI Summary</h4>
                          </div>
                          <div style={{ color: '#4a044e', fontSize: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {r.aiSummary}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DoctorAppointments