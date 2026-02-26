import { useEffect, useState } from 'react'
import { db, storage } from '../../firebase/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../../context/AuthContext'

const SPECIALIZATIONS = ['General', 'Cardiology', 'Dermatology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Gynecology', 'ENT', 'Ophthalmology']

function DoctorProfile() {
  const { user } = useAuth()
  const [form, setForm] = useState({ name: '', specialization: '', bio: '', phone: '', consultationDuration: 30, photoURL: '' })
  const [photoFile, setPhotoFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      const snap = await getDoc(doc(db, 'doctors', user.uid))
      if (snap.exists()) setForm(snap.data())
      setLoading(false)
    }
    fetchProfile()
  }, [user])

  const handleSave = async (e) => {
    e.preventDefault()
    setUploading(true)
    let photoURL = form.photoURL
    if (photoFile) {
      const storageRef = ref(storage, `doctorPhotos/${user.uid}/${photoFile.name}`)
      const task = uploadBytesResumable(storageRef, photoFile)
      photoURL = await new Promise((resolve, reject) => {
        task.on('state_changed', null, reject, async () => resolve(await getDownloadURL(task.snapshot.ref)))
      })
    }
    await setDoc(doc(db, 'doctors', user.uid), { ...form, photoURL, updatedAt: new Date().toISOString() })
    setForm(prev => ({ ...prev, photoURL }))
    setUploading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div style={{ padding: '2rem', color: '#94a3b8' }}>Loading profile...</div>

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <h1>👤 Doctor Profile</h1>

      <div style={{ background: '#fff', borderRadius: '12px', padding: '2rem', boxShadow: '0 2px 8px #0001' }}>
        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '3px solid #2563eb' }}>
            {form.photoURL ? <img src={form.photoURL} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '2.5rem' }}>👨‍⚕️</span>}
          </div>
          <div>
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{form.name || 'Your Name'}</p>
            <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: '0.9rem' }}>{form.specialization || 'Specialization'}</p>
            <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0])}
              style={{ fontSize: '0.85rem' }} />
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>👨‍⚕️ Full Name</label>
              <input
                type="text" value={form.name} placeholder="Dr. Your Name"
                onChange={e => setForm({ ...form, name: e.target.value })} required
                style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>🏥 Specialization</label>
              <select value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} required
                style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem' }}>
                <option value="">Select Specialization</option>
                {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>📞 Phone</label>
              <input
                type="tel" value={form.phone} placeholder="Phone number"
                onChange={e => setForm({ ...form, phone: e.target.value })}
                style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>⏱️ Consultation Duration (min)</label>
              <input
                type="number" value={form.consultationDuration} min={5} max={120} step={5}
                onChange={e => setForm({ ...form, consultationDuration: Number(e.target.value) })}
                style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#374151' }}>📝 Bio / About</label>
            <textarea
              value={form.bio} placeholder="Brief description about yourself, experience, expertise..."
              onChange={e => setForm({ ...form, bio: e.target.value })}
              style={{ width: '100%', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', minHeight: '90px', resize: 'vertical', fontSize: '0.95rem', boxSizing: 'border-box' }}
            />
          </div>
          <button type="submit" disabled={uploading}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 32px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>
            {uploading ? 'Saving...' : saved ? '✅ Saved!' : '💾 Save Profile'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default DoctorProfile