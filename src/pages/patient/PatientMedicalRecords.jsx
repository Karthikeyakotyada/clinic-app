import { useState, useEffect, useRef } from 'react'
import { db, storage } from '../../firebase/firebase'
import {
    collection, addDoc, query, where, onSnapshot, deleteDoc, doc
} from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { useAuth } from '../../context/AuthContext'

const RECORD_TYPES = [
    'Blood Test', 'X-Ray', 'MRI / CT Scan', 'ECG', 'Ultra Sound',
    'Prescription', 'Vaccination Record', 'Discharge Summary', 'Other',
]

const TYPE_ICONS = {
    'Blood Test': '🩸',
    'X-Ray': '🦴',
    'MRI / CT Scan': '🧠',
    'ECG': '❤️',
    'Ultra Sound': '🔊',
    'Prescription': '💊',
    'Vaccination Record': '💉',
    'Discharge Summary': '📋',
    'Other': '📄',
}

function PatientMedicalRecords() {
    const { user } = useAuth()
    const fileRef = useRef()

    const [records, setRecords] = useState([])
    const [loading, setLoading] = useState(true)

    // Upload form state
    const [file, setFile] = useState(null)
    const [recordType, setRecordType] = useState('')
    const [notes, setNotes] = useState('')
    const [recordDate, setRecordDate] = useState('')
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [msg, setMsg] = useState(null)
    const [deleting, setDeleting] = useState(null)

    /* ── Real-time listener: own records ── */
    useEffect(() => {
        if (!user) return
        const q = query(collection(db, 'medicalRecords'), where('patientId', '==', user.uid))
        return onSnapshot(q, snap => {
            const list = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => b.uploadedAt > a.uploadedAt ? 1 : -1)
            setRecords(list)
            setLoading(false)
        })
    }, [user])

    /* ── Upload handler ── */
    const handleUpload = async (e) => {
        e.preventDefault()
        if (!file) { setMsg({ type: 'error', text: 'Please choose a file to upload.' }); return }
        if (!recordType) { setMsg({ type: 'error', text: 'Please select the record type.' }); return }
        if (file.size > 20 * 1024 * 1024) {
            setMsg({ type: 'error', text: 'File too large. Max allowed is 20 MB.' }); return
        }

        setUploading(true)
        setProgress(0)
        setMsg(null)

        try {
            const ext = file.name.split('.').pop()
            const fileName = `medicalRecords/${user.uid}/${Date.now()}.${ext}`
            const storageRef = ref(storage, fileName)
            const uploadTask = uploadBytesResumable(storageRef, file)

            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                    snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
                    reject,
                    resolve,
                )
            })

            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)

            await addDoc(collection(db, 'medicalRecords'), {
                patientId: user.uid,
                patientName: user.displayName || user.email,
                recordType,
                notes,
                recordDate: recordDate || null,
                fileName: file.name,
                fileURL: downloadURL,
                filePath: fileName,
                uploadedAt: new Date().toISOString(),
            })

            setMsg({ type: 'success', text: '✅ Medical record uploaded successfully!' })
            setFile(null)
            setRecordType('')
            setNotes('')
            setRecordDate('')
            setProgress(0)
            if (fileRef.current) fileRef.current.value = ''
        } catch (err) {
            console.error(err)
            setMsg({ type: 'error', text: 'Upload failed. Please try again.' })
        } finally {
            setUploading(false)
        }
    }

    /* ── Delete ── */
    const handleDelete = async (record) => {
        if (!window.confirm(`Delete "${record.fileName}"? This cannot be undone.`)) return
        setDeleting(record.id)
        try {
            // Delete from Storage
            try { await deleteObject(ref(storage, record.filePath)) } catch (_) { /* might already be gone */ }
            // Delete Firestore doc
            await deleteDoc(doc(db, 'medicalRecords', record.id))
        } catch (err) {
            alert('Delete failed. Please try again.')
        } finally {
            setDeleting(null)
        }
    }

    const labelStyle = {
        display: 'block',
        fontSize: '0.8rem',
        fontWeight: 700,
        color: '#374151',
        marginBottom: '6px',
    }
    const inputStyle = {
        width: '100%',
        padding: '10px 14px',
        border: '2px solid #e2e8f0',
        borderRadius: '10px',
        fontSize: '0.9rem',
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        transition: 'border 0.2s',
        background: '#f8fafc',
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '860px', margin: '0 auto', fontFamily: "'Segoe UI', sans-serif" }}>

            {/* ── Header ── */}
            <div style={{ marginBottom: '1.8rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#1e293b' }}>
                    🗂️ Medical Records
                </h1>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                    Upload and manage your past medical records securely.
                </p>
            </div>

            {/* ── Upload Form ── */}
            <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: '1.6rem', marginBottom: '2rem' }}>
                <h2 style={{ margin: '0 0 1.2rem', fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
                    ➕ Upload a New Record
                </h2>

                {msg && (
                    <div style={{
                        padding: '10px 16px', borderRadius: '10px', marginBottom: '1rem',
                        fontSize: '0.88rem', fontWeight: 600,
                        background: msg.type === 'success' ? '#dcfce7' : '#fee2e2',
                        color: msg.type === 'success' ? '#15803d' : '#dc2626',
                        border: `1px solid ${msg.type === 'success' ? '#86efac' : '#fca5a5'}`,
                    }}>
                        {msg.text}
                    </div>
                )}

                <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* Record Type */}
                    <div>
                        <label style={labelStyle}>📋 Record Type <span style={{ color: '#dc2626' }}>*</span></label>
                        <select
                            style={{ ...inputStyle, cursor: 'pointer' }}
                            value={recordType}
                            onChange={e => setRecordType(e.target.value)}
                            required
                        >
                            <option value="">-- Select type --</option>
                            {RECORD_TYPES.map(t => (
                                <option key={t} value={t}>{TYPE_ICONS[t]} {t}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date and File row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={labelStyle}>📅 Record Date (optional)</label>
                            <input
                                style={inputStyle}
                                type="date"
                                value={recordDate}
                                onChange={e => setRecordDate(e.target.value)}
                                max={new Date().toLocaleDateString('en-CA')}
                                onFocus={e => e.target.style.borderColor = '#2563eb'}
                                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>📎 File (PDF / Image) <span style={{ color: '#dc2626' }}>*</span></label>
                            <input
                                ref={fileRef}
                                style={{ ...inputStyle, padding: '8px 14px', cursor: 'pointer' }}
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                                onChange={e => setFile(e.target.files[0] || null)}
                                required
                            />
                            <p style={{ margin: '3px 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>
                                Max 20 MB · PDF, JPG, PNG, DOCX
                            </p>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label style={labelStyle}>📝 Notes (optional)</label>
                        <textarea
                            style={{ ...inputStyle, resize: 'vertical', minHeight: '64px' }}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="E.g. Report from Apollo Hospital, 2023 annual check-up"
                            onFocus={e => e.target.style.borderColor = '#2563eb'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>

                    {/* Progress bar */}
                    {uploading && (
                        <div>
                            <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #2563eb, #7c3aed)', borderRadius: '6px', transition: 'width 0.3s' }} />
                            </div>
                            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748b' }}>{progress}% uploaded...</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={uploading}
                        style={{
                            padding: '12px',
                            background: uploading ? '#94a3b8' : 'linear-gradient(135deg, #1e3a8a, #2563eb)',
                            color: '#fff', border: 'none', borderRadius: '10px',
                            fontSize: '0.95rem', fontWeight: 700,
                            cursor: uploading ? 'not-allowed' : 'pointer',
                            transition: 'box-shadow 0.2s',
                        }}
                    >
                        {uploading ? `⏳ Uploading ${progress}%...` : '⬆️ Upload Record'}
                    </button>
                </form>
            </div>

            {/* ── Records List ── */}
            <div>
                <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
                    📁 My Records ({records.length})
                </h2>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        <div style={{ fontSize: '2rem' }}>⏳</div>
                        <p>Loading records...</p>
                    </div>
                ) : records.length === 0 ? (
                    <div style={{ background: '#fff', borderRadius: '14px', padding: '3rem', textAlign: 'center', color: '#94a3b8', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🗂️</div>
                        <p style={{ fontWeight: 600, margin: 0 }}>No records yet.</p>
                        <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>Use the form above to upload your first medical record.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {records.map(r => (
                            <div key={r.id} style={{
                                background: '#fff', borderRadius: '12px', padding: '14px 18px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
                                border: '1px solid #f1f5f9',
                            }}>
                                {/* Type icon */}
                                <div style={{
                                    width: '44px', height: '44px', borderRadius: '10px',
                                    background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.4rem', flexShrink: 0,
                                }}>
                                    {TYPE_ICONS[r.recordType] || '📄'}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: '180px' }}>
                                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{r.recordType}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                                        {r.fileName}
                                        {r.recordDate && ` · 📅 ${r.recordDate}`}
                                    </p>
                                    {r.notes && (
                                        <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                                            "{r.notes}"
                                        </p>
                                    )}
                                    <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: '#94a3b8' }}>
                                        Uploaded: {new Date(r.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                    <a
                                        href={r.fileURL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            background: '#eff6ff', color: '#2563eb',
                                            border: '1px solid #bfdbfe',
                                            borderRadius: '8px', padding: '6px 14px',
                                            textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700,
                                        }}
                                    >
                                        📥 View
                                    </a>
                                    <button
                                        onClick={() => handleDelete(r)}
                                        disabled={deleting === r.id}
                                        style={{
                                            background: '#fee2e2', color: '#dc2626',
                                            border: '1px solid #fca5a5',
                                            borderRadius: '8px', padding: '6px 14px',
                                            fontSize: '0.82rem', fontWeight: 700,
                                            cursor: deleting === r.id ? 'not-allowed' : 'pointer',
                                            opacity: deleting === r.id ? 0.6 : 1,
                                        }}
                                    >
                                        {deleting === r.id ? '⏳' : '🗑️'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default PatientMedicalRecords
