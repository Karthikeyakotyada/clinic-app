import { useEffect, useState } from 'react'
import { db, storage } from '../../firebase/firebase'
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../../context/AuthContext'

function DoctorPrescriptions() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [prescriptions, setPrescriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ appointmentId: '', patientName: '', patientId: '', notes: '' })
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [success, setSuccess] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const apptSnap = await getDocs(query(collection(db, 'appointments'), where('doctorId', '==', user.uid)))
    const appts = apptSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    setAppointments(appts)

    const rxSnap = await getDocs(query(collection(db, 'prescriptions'), where('doctorId', '==', user.uid)))
    const rxs = rxSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    rxs.sort((a, b) => b.uploadedAt > a.uploadedAt ? 1 : -1)
    setPrescriptions(rxs)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [user])

  const handleAppointmentSelect = (e) => {
    const apptId = e.target.value
    const appt = appointments.find(a => a.id === apptId)
    if (appt) setForm({ appointmentId: apptId, patientName: appt.patientName, patientId: appt.patientId, notes: '' })
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!form.appointmentId || !form.notes) return
    setUploading(true)

    try {
      let fileURL = ''
      if (file) {
        const storageRef = ref(storage, `prescriptions/${form.appointmentId}/${file.name}`)
        const uploadTask = uploadBytesResumable(storageRef, file)
        fileURL = await new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
            reject,
            async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
          )
        })
      }

      await addDoc(collection(db, 'prescriptions'), {
        appointmentId: form.appointmentId,
        patientId: form.patientId,
        patientName: form.patientName,
        doctorId: user.uid,
        doctorName: user.displayName || user.email,
        notes: form.notes,
        fileURL,
        fileName: file?.name || '',
        uploadedAt: new Date().toISOString(),
      })

      setSuccess(true)
      setForm({ appointmentId: '', patientName: '', patientId: '', notes: '' })
      setFile(null)
      setUploadProgress(0)
      setShowForm(false)
      fetchData()
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error(err)
    }
    setUploading(false)
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>💊 Prescriptions</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>Upload and manage patient prescriptions</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontWeight: 600 }}>
          {showForm ? '✖ Close' : '+ New Prescription'}
        </button>
      </div>

      {success && (
        <div style={{ background: '#dcfce7', color: '#16a34a', padding: '12px 20px', borderRadius: '8px', marginBottom: '1rem', fontWeight: 600 }}>
          ✅ Prescription uploaded successfully!
        </div>
      )}

      {/* Upload Form */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px #0001', marginBottom: '2rem' }}>
          <h2 style={{ marginTop: 0 }}>➕ Upload Prescription</h2>
          <form onSubmit={handleUpload}>
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>👤 Select Patient Appointment</label>
                <select
                  value={form.appointmentId}
                  onChange={handleAppointmentSelect}
                  required
                  style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem' }}>
                  <option value="">-- Select Appointment --</option>
                  {appointments.map(a => (
                    <option key={a.id} value={a.id}>{a.patientName} — {a.date} {a.timeSlot}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>📎 Upload File (PDF/Image)</label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={e => setFile(e.target.files[0])}
                  style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>📝 Prescription Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Write prescription details, medicines, dosage..."
                required
                style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', minHeight: '100px', resize: 'vertical', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>
            {uploading && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ background: '#e2e8f0', borderRadius: '20px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ background: '#2563eb', height: '100%', width: `${uploadProgress}%`, transition: 'width 0.3s' }} />
                </div>
                <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0' }}>Uploading... {uploadProgress}%</p>
              </div>
            )}
            <button type="submit" disabled={uploading}
              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 28px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>
              {uploading ? 'Uploading...' : '✅ Upload Prescription'}
            </button>
          </form>
        </div>
      )}

      {/* Prescriptions List */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 8px #0001' }}>
        <h2 style={{ marginTop: 0 }}>📋 Uploaded Prescriptions</h2>
        {loading ? (
          <p style={{ color: '#94a3b8' }}>Loading...</p>
        ) : prescriptions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
            <div style={{ fontSize: '3rem' }}>💊</div>
            <p>No prescriptions uploaded yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {prescriptions.map(rx => (
              <div key={rx.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '1rem' }}>👤 {rx.patientName}</strong>
                    <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{rx.uploadedAt?.split('T')[0]}</span>
                  </div>
                  <p style={{ margin: '0', color: '#475569', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{rx.notes}</p>
                </div>
                {rx.fileURL && (
                  <a href={rx.fileURL} target="_blank" rel="noopener noreferrer"
                    style={{ background: '#eff6ff', color: '#2563eb', padding: '8px 16px', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    📥 {rx.fileName || 'Download'}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DoctorPrescriptions