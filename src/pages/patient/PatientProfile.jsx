import { useState, useEffect } from 'react'
import { auth, db } from '../../firebase/firebase'
import { updateProfile } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'

const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    border: '2px solid #e2e8f0',
    borderRadius: '10px',
    fontSize: '0.95rem',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border 0.2s',
}
const labelStyle = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#374151',
    marginBottom: '6px',
}

function PatientProfile() {
    const { user } = useAuth()

    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [dob, setDob] = useState('')
    const [gender, setGender] = useState('')
    const [address, setAddress] = useState('')

    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState(null)   // { type: 'success'|'error', text }
    const [loading, setLoading] = useState(true)

    /* ── Load from Firestore on mount ── */
    useEffect(() => {
        if (!user) return
        const load = async () => {
            const snap = await getDoc(doc(db, 'users', user.uid))
            if (snap.exists()) {
                const d = snap.data()
                setName(d.name || user.displayName || '')
                setPhone(d.phone || '')
                setDob(d.dob || '')
                setGender(d.gender || '')
                setAddress(d.address || '')
            } else {
                setName(user.displayName || '')
            }
            setEmail(user.email || '')
            setLoading(false)
        }
        load()
    }, [user])

    /* ── Save ── */
    const handleSave = async (e) => {
        e.preventDefault()
        if (name.trim().length < 2) {
            setMsg({ type: 'error', text: 'Name must be at least 2 characters.' })
            return
        }
        if (phone && !/^\+?[\d\s\-]{7,15}$/.test(phone)) {
            setMsg({ type: 'error', text: 'Please enter a valid phone number.' })
            return
        }
        setSaving(true)
        setMsg(null)
        try {
            // Update Firebase Auth display name
            await updateProfile(auth.currentUser, { displayName: name.trim() })

            // Update Firestore user doc
            await setDoc(doc(db, 'users', user.uid), {
                name: name.trim(),
                email: user.email,
                phone,
                dob,
                gender,
                address,
                role: 'patient',
                updatedAt: new Date().toISOString(),
            }, { merge: true })

            setMsg({ type: 'success', text: '✅ Profile updated successfully!' })
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to save. Please try again.' })
        } finally {
            setSaving(false)
        }
    }

    if (loading) return (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '2rem' }}>⏳</div>
            <p>Loading your profile...</p>
        </div>
    )

    const avatarLetter = (name || email || '?')[0].toUpperCase()

    return (
        <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto', fontFamily: "'Segoe UI', sans-serif" }}>

            {/* ── Header ── */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#1e293b' }}>
                    👤 My Profile
                </h1>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                    Update your personal information below.
                </p>
            </div>

            {/* ── Avatar + Email strip ── */}
            <div style={{
                background: 'linear-gradient(135deg, #1e3a8a, #2563eb)',
                borderRadius: '16px',
                padding: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1.2rem',
                marginBottom: '1.8rem',
                color: '#fff',
            }}>
                <div style={{
                    width: '64px', height: '64px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.8rem', fontWeight: 900, flexShrink: 0,
                    border: '2px solid rgba(255,255,255,0.4)',
                }}>
                    {avatarLetter}
                </div>
                <div>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem' }}>{name || 'No name set'}</p>
                    <p style={{ margin: '2px 0 0', opacity: 0.75, fontSize: '0.88rem' }}>📧 {email}</p>
                    <span style={{
                        display: 'inline-block', marginTop: '6px',
                        background: 'rgba(255,255,255,0.15)', borderRadius: '20px',
                        padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em',
                    }}>
                        🧑 PATIENT
                    </span>
                </div>
            </div>

            {/* ── Alert messages ── */}
            {msg && (
                <div style={{
                    padding: '11px 16px', borderRadius: '10px', marginBottom: '1.2rem',
                    fontSize: '0.88rem', fontWeight: 600,
                    background: msg.type === 'success' ? '#dcfce7' : '#fee2e2',
                    color: msg.type === 'success' ? '#15803d' : '#dc2626',
                    border: `1px solid ${msg.type === 'success' ? '#86efac' : '#fca5a5'}`,
                }}>
                    {msg.text}
                </div>
            )}

            {/* ── Form ── */}
            <form onSubmit={handleSave}>
                <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: '1.6rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

                    <h3 style={{ margin: '0 0 0.4rem', fontSize: '0.95rem', fontWeight: 800, color: '#1e293b' }}>
                        Personal Information
                    </h3>

                    {/* Name */}
                    <div>
                        <label style={labelStyle}>🙍 Full Name <span style={{ color: '#dc2626' }}>*</span></label>
                        <input
                            style={inputStyle}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Your full name"
                            required
                            onFocus={e => e.target.style.borderColor = '#2563eb'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label style={labelStyle}>📞 Phone Number</label>
                        <input
                            style={inputStyle}
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="+91 98765 43210"
                            type="tel"
                            onFocus={e => e.target.style.borderColor = '#2563eb'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>

                    {/* Email (read-only) */}
                    <div>
                        <label style={labelStyle}>📧 Email Address</label>
                        <input
                            style={{ ...inputStyle, background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                            value={email}
                            readOnly
                        />
                        <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>
                            Email cannot be changed after registration.
                        </p>
                    </div>

                    {/* DOB + Gender row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={labelStyle}>🎂 Date of Birth</label>
                            <input
                                style={inputStyle}
                                type="date"
                                value={dob}
                                onChange={e => setDob(e.target.value)}
                                onFocus={e => e.target.style.borderColor = '#2563eb'}
                                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>⚧️ Gender</label>
                            <select
                                style={{ ...inputStyle, background: '#f8fafc', cursor: 'pointer' }}
                                value={gender}
                                onChange={e => setGender(e.target.value)}
                            >
                                <option value="">-- Select --</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                        </div>
                    </div>

                    {/* Address */}
                    <div>
                        <label style={labelStyle}>🏠 Address</label>
                        <textarea
                            style={{ ...inputStyle, resize: 'vertical', minHeight: '72px' }}
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            placeholder="Your home address"
                            onFocus={e => e.target.style.borderColor = '#2563eb'}
                            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                        />
                    </div>

                </div>

                {/* ── Save Button ── */}
                <button
                    type="submit"
                    disabled={saving}
                    style={{
                        width: '100%', marginTop: '1.2rem',
                        padding: '13px',
                        background: saving ? '#94a3b8' : 'linear-gradient(135deg, #1e3a8a, #2563eb)',
                        color: '#fff', border: 'none', borderRadius: '10px',
                        fontSize: '1rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                        transition: 'transform 0.1s, box-shadow 0.2s',
                    }}
                    onMouseEnter={e => { if (!saving) e.target.style.boxShadow = '0 6px 20px rgba(37,99,235,0.38)' }}
                    onMouseLeave={e => { e.target.style.boxShadow = 'none' }}
                >
                    {saving ? '💾 Saving...' : '💾 Save Profile'}
                </button>
            </form>
        </div>
    )
}

export default PatientProfile
