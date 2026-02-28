import { useEffect, useState } from 'react'
import { db } from '../../firebase/firebase'
import {
    collection, onSnapshot, doc, setDoc, updateDoc, getDoc
} from 'firebase/firestore'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const S = {
    page: { padding: '2rem', maxWidth: '1100px', margin: '0 auto', fontFamily: "'Segoe UI', sans-serif" },
    card: { background: '#fff', borderRadius: '14px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '1.25rem' },
    cardHeader: { padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' },
    cardBody: { padding: '1.25rem 1.5rem' },
    tag: (bg, color) => ({ background: bg, color, padding: '3px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 }),
    input: { padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '0.85rem', outline: 'none', background: '#f8fafc' },
    btn: (bg, color) => ({
        background: bg, color, border: 'none', borderRadius: '8px', padding: '7px 16px',
        cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', transition: 'opacity .15s'
    }),
    row: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' },
    label: { fontSize: '0.82rem', fontWeight: 700, color: '#475569', minWidth: '110px' },
}

/* ── Saving toast ── */
function Toast({ msg }) {
    if (!msg) return null
    return (
        <div style={{
            position: 'fixed', bottom: '1.5rem', right: '1.5rem',
            background: '#1e293b', color: '#fff', padding: '10px 20px',
            borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 9999,
            animation: 'fadeIn .2s ease'
        }}>
            {msg}
        </div>
    )
}

/* ── Doctor expand card ── */
function DoctorScheduleCard({ doctor, avail, onSave }) {
    const todayDay = DAYS[((new Date().getDay() + 6) % 7)]  // Mon=0 offset fix
    const [workDays, setWorkDays] = useState(avail?.workingDays || {})
    const [offDates, setOffDates] = useState(avail?.offDates || [])
    const [consultDur, setConsultDur] = useState(doctor.consultationDuration || 15)
    const [newOff, setNewOff] = useState('')
    const [saving, setSaving] = useState(false)
    const [expanded, setExpanded] = useState(false)

    // sync when parent data changes
    useEffect(() => {
        setWorkDays(avail?.workingDays || {})
        setOffDates(avail?.offDates || [])
        setConsultDur(doctor.consultationDuration || 15)
    }, [avail, doctor])

    const toggleDay = (day) => {
        setWorkDays(prev => {
            if (prev[day]) {
                const n = { ...prev }; delete n[day]; return n
            }
            return { ...prev, [day]: { start: '09:00', end: '17:00' } }
        })
    }

    const setHour = (day, key, val) => {
        setWorkDays(prev => ({ ...prev, [day]: { ...prev[day], [key]: val } }))
    }

    const addOffDate = () => {
        if (!newOff || offDates.includes(newOff)) return
        setOffDates(prev => [...prev, newOff].sort())
        setNewOff('')
    }

    const removeOffDate = (d) => setOffDates(prev => prev.filter(x => x !== d))

    const handleSave = async () => {
        setSaving(true)
        await onSave(doctor.id, { workingDays: workDays, offDates }, consultDur)
        setSaving(false)
    }

    const today = new Date().toLocaleDateString('en-CA')
    const availableToday = workDays[todayDay] && !offDates.includes(today)

    return (
        <div style={S.card}>
            {/* Header */}
            <div style={{
                ...S.cardHeader,
                background: availableToday ? 'linear-gradient(90deg,#065f46,#16a34a)' : 'linear-gradient(90deg,#374151,#4b5563)',
                cursor: 'pointer'
            }} onClick={() => setExpanded(e => !e)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                        {doctor.photoURL
                            ? <img src={doctor.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            : '👨‍⚕️'}
                    </div>
                    <div>
                        <div style={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>{doctor.name || 'Unknown Doctor'}</div>
                        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem' }}>{doctor.specialization || '—'}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={S.tag(availableToday ? '#dcfce7' : '#fee2e2', availableToday ? '#166534' : '#991b1b')}>
                        {availableToday ? '✅ Available Today' : '❌ Unavailable Today'}
                    </span>
                    <span style={S.tag('rgba(255,255,255,0.15)', '#fff')}>⏱ {consultDur} min/pt</span>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem' }}>{expanded ? '▲' : '▼'}</span>
                </div>
            </div>

            {expanded && (
                <div style={S.cardBody}>

                    {/* Consultation Duration */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '8px' }}>
                            ⏱ CONSULTATION DURATION (mins/patient)
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button onClick={() => setConsultDur(d => Math.max(5, d - 5))} style={{ ...S.btn('#f1f5f9', '#1e293b'), fontSize: '1rem', padding: '5px 12px' }}>−</button>
                            <input
                                type="number" min="5" max="120" step="5"
                                value={consultDur}
                                onChange={e => setConsultDur(Math.max(5, parseInt(e.target.value) || 5))}
                                style={{ ...S.input, width: '60px', textAlign: 'center', fontWeight: 800 }}
                            />
                            <button onClick={() => setConsultDur(d => Math.min(120, d + 5))} style={{ ...S.btn('#f1f5f9', '#1e293b'), fontSize: '1rem', padding: '5px 12px' }}>+</button>
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>minutes per consultation</span>
                        </div>
                    </div>

                    {/* Working Days */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '8px' }}>
                            📅 WORKING DAYS & HOURS
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {DAYS.map(day => (
                                <button
                                    key={day}
                                    onClick={() => toggleDay(day)}
                                    style={{
                                        padding: '5px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700,
                                        border: '2px solid',
                                        borderColor: workDays[day] ? '#2563eb' : '#e2e8f0',
                                        background: workDays[day] ? '#eff6ff' : '#f8fafc',
                                        color: workDays[day] ? '#2563eb' : '#94a3b8',
                                        cursor: 'pointer', transition: 'all .15s'
                                    }}
                                >
                                    {day.slice(0, 3)}
                                </button>
                            ))}
                        </div>
                        {DAYS.filter(d => workDays[d]).map(day => (
                            <div key={day} style={S.row}>
                                <span style={S.label}>{day}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input type="time" value={workDays[day]?.start || '09:00'}
                                        onChange={e => setHour(day, 'start', e.target.value)}
                                        style={S.input} />
                                    <span style={{ color: '#94a3b8', fontWeight: 700 }}>→</span>
                                    <input type="time" value={workDays[day]?.end || '17:00'}
                                        onChange={e => setHour(day, 'end', e.target.value)}
                                        style={S.input} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Off Dates */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 800, letterSpacing: '0.05em', marginBottom: '8px' }}>
                            🚫 OFF / LEAVE DATES
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <input type="date" value={newOff} onChange={e => setNewOff(e.target.value)} style={S.input} />
                            <button onClick={addOffDate} style={S.btn('#fef9c3', '#92400e')}>＋ Add Off Day</button>
                        </div>
                        {offDates.length === 0
                            ? <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>No off dates set.</span>
                            : (
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    {offDates.map(d => (
                                        <span key={d} style={{ ...S.tag('#fee2e2', '#dc2626'), display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            {d}
                                            <button onClick={() => removeOffDate(d)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 900, fontSize: '0.9rem', padding: 0, lineHeight: 1 }}>
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                    </div>

                    {/* Save */}
                    <button onClick={handleSave} disabled={saving} style={{ ...S.btn(saving ? '#94a3b8' : '#2563eb', '#fff'), padding: '9px 24px', fontSize: '0.88rem' }}>
                        {saving ? '⏳ Saving...' : '💾 Save Schedule'}
                    </button>
                </div>
            )}
        </div>
    )
}

/* ── Main Page ── */
function ReceptionSchedule() {
    const [doctors, setDoctors] = useState([])
    const [availability, setAvailability] = useState({})
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [toast, setToast] = useState('')

    useEffect(() => {
        const unsubDr = onSnapshot(collection(db, 'doctors'), snap => {
            setDoctors(snap.docs.map(d => ({ id: d.id, ...d.data() })))
            setLoading(false)
        })
        const unsubAv = onSnapshot(collection(db, 'doctorAvailability'), snap => {
            const m = {}
            snap.docs.forEach(d => { m[d.id] = d.data() })
            setAvailability(m)
        })
        return () => { unsubDr(); unsubAv() }
    }, [])

    const showToast = (msg) => {
        setToast(msg)
        setTimeout(() => setToast(''), 2500)
    }

    const handleSave = async (doctorId, availData, consultDur) => {
        // Update doctorAvailability collection (doc id = doctorId)
        await setDoc(doc(db, 'doctorAvailability', doctorId), availData, { merge: true })
        // Update consultationDuration on the doctor record itself
        await updateDoc(doc(db, 'doctors', doctorId), { consultationDuration: consultDur })
        showToast('✅ Schedule saved!')
    }

    const filtered = doctors.filter(d =>
        !search ||
        d.name?.toLowerCase().includes(search.toLowerCase()) ||
        d.specialization?.toLowerCase().includes(search.toLowerCase())
    )

    const todayStr = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    return (
        <div style={S.page}>
            <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }`}</style>
            <Toast msg={toast} />

            {/* Header */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.6rem' }}>🗓️</span>
                            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#1e293b' }}>Doctor Schedule Manager</h1>
                        </div>
                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.88rem' }}>
                            Manage working hours, consultation duration & leave dates · 📅 {todayStr}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ background: '#dcfce7', color: '#166534', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                            ✅ {doctors.filter(d => {
                                const todayDay = DAYS[((new Date().getDay() + 6) % 7)]
                                const av = availability[d.id]
                                const today = new Date().toLocaleDateString('en-CA')
                                return av?.workingDays?.[todayDay] && !av?.offDates?.includes(today)
                            }).length} Available Today
                        </div>
                        <div style={{ background: '#fee2e2', color: '#dc2626', padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                            ❌ {doctors.filter(d => {
                                const todayDay = DAYS[((new Date().getDay() + 6) % 7)]
                                const av = availability[d.id]
                                const today = new Date().toLocaleDateString('en-CA')
                                return !av?.workingDays?.[todayDay] || av?.offDates?.includes(today)
                            }).length} Unavailable
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <input
                placeholder="🔍 Search doctor by name or specialization..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...S.input, width: '100%', marginBottom: '1.25rem', padding: '10px 14px', fontSize: '0.92rem', boxSizing: 'border-box' }}
            />

            {/* Tip */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 16px', marginBottom: '1.5rem', fontSize: '0.82rem', color: '#1e40af' }}>
                💡 Click on a doctor card to expand and edit their schedule. Changes save to Firestore instantly and affect patient-facing wait time calculations.
            </div>

            {/* Doctor Cards */}
            {loading ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem', fontSize: '1rem' }}>Loading doctors...</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👨‍⚕️</div>
                    <p>No doctors found.</p>
                </div>
            ) : (
                filtered.map(doctor => (
                    <DoctorScheduleCard
                        key={doctor.id}
                        doctor={doctor}
                        avail={availability[doctor.id]}
                        onSave={handleSave}
                    />
                ))
            )}
        </div>
    )
}

export default ReceptionSchedule
