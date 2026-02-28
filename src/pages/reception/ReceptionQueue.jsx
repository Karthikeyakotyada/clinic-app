import { useEffect, useState, useRef } from 'react'
import { db } from '../../firebase/firebase'
import {
    collection, onSnapshot, doc, updateDoc, writeBatch, query, where, getDocs
} from 'firebase/firestore'
import { getDoctorTracker } from '../../utils/queueEngine'

/* ─── Queue recalculation (in-memory, no extra Firestore read) ─── */
async function recalcWaiting(doctorId, date, allAppointments, removedId, delayMinutes, consultDur) {
    const remaining = allAppointments
        .filter(a =>
            a.doctorId === doctorId &&
            a.date === date &&
            a.status === 'Waiting' &&
            a.id !== removedId
        )
        .sort((a, b) => {
            const ta = a.arrivedAt ? new Date(a.arrivedAt).getTime() : 0
            const tb = b.arrivedAt ? new Date(b.arrivedAt).getTime() : 0
            return ta - tb
        })

    if (remaining.length === 0) return
    const total = remaining.length
    const batch = writeBatch(db)
    remaining.forEach((p, i) => {
        batch.update(doc(db, 'appointments', p.id), {
            queuePosition: i + 1,
            patientsBefore: i,
            patientsAfter: total - i - 1,
            waitingTime: delayMinutes + (i * consultDur),
            delayMinutes,
            consultationDuration: consultDur,
        })
    })
    await batch.commit()
}

/* ─── Recalculate ALL Waiting for a doctor when consult duration changes ─── */
async function recalcNewDuration(doctorId, date, allAppointments, delayMinutes, consultDur) {
    const waiting = allAppointments
        .filter(a => a.doctorId === doctorId && a.date === date && a.status === 'Waiting')
        .sort((a, b) => {
            const ta = a.arrivedAt ? new Date(a.arrivedAt).getTime() : 0
            const tb = b.arrivedAt ? new Date(b.arrivedAt).getTime() : 0
            return ta - tb
        })

    if (waiting.length === 0) return
    const total = waiting.length
    const batch = writeBatch(db)
    waiting.forEach((p, i) => {
        batch.update(doc(db, 'appointments', p.id), {
            queuePosition: i + 1,
            patientsBefore: i,
            patientsAfter: total - i - 1,
            waitingTime: delayMinutes + (i * consultDur),
            delayMinutes,
            consultationDuration: consultDur,
        })
    })
    await batch.commit()
}

/* ─── Helpers ─── */
function fmt(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function WaitBadge({ minutes }) {
    if (minutes == null) return <span style={{ color: '#94a3b8' }}>—</span>
    if (minutes === 0) return (
        <span style={{ background: '#dcfce7', color: '#16a34a', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800 }}>
            🟢 Next
        </span>
    )
    return (
        <span style={{ background: '#fff7ed', color: '#ea580c', padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 800 }}>
            ⏳ ~{minutes} min
        </span>
    )
}

/* ─── Per-doctor Queue Panel ─── */
function DoctorQueuePanel({ doctorId, doctorName, specialization, consultDur: initDur, tracker, appointments, today }) {
    const [consultDur, setConsultDur] = useState(initDur)
    const [editDur, setEditDur] = useState(false)
    const [spinning, setSpinning] = useState(null)
    const [saving, setSaving] = useState(false)

    // Update local when prop changes (parent re-fetch)
    useEffect(() => { setConsultDur(initDur) }, [initDur])

    const waiting = appointments
        .filter(a => a.doctorId === doctorId && a.date === today && a.status === 'Waiting')
        .sort((a, b) => (a.queuePosition ?? 999) - (b.queuePosition ?? 999))

    const inConsult = appointments.find(a => a.doctorId === doctorId && a.date === today && a.status === 'In Consultation')

    const delayMins = tracker?.delayMinutes ?? 0

    /* Start consultation — Waiting → In Consultation */
    const handleStart = async (appt) => {
        setSpinning(appt.id)
        try {
            await updateDoc(doc(db, 'appointments', appt.id), { status: 'In Consultation' })
            await recalcWaiting(doctorId, today, appointments, appt.id, delayMins, consultDur)
        } finally { setSpinning(null) }
    }

    /* Complete — In Consultation → Completed */
    const handleComplete = async (appt) => {
        setSpinning(appt.id)
        try {
            await updateDoc(doc(db, 'appointments', appt.id), { status: 'Completed' })
            // Don't pass removedId since it's not Waiting anyway; just recalc all remaining
            await recalcWaiting(doctorId, today, appointments, '__none__', delayMins, consultDur)
        } finally { setSpinning(null) }
    }

    /* Save new consult duration → recalculate everyone */
    const handleSaveDur = async () => {
        setSaving(true)
        try {
            // Persist to doctor record
            const doctorSnap = await getDocs(query(collection(db, 'doctors'), where('__name__', '==', doctorId)))
            if (!doctorSnap.empty) {
                await updateDoc(doc(db, 'doctors', doctorId), { consultationDuration: consultDur })
            }
            // Recalculate all waiting patients with the new duration
            await recalcNewDuration(doctorId, today, appointments, delayMins, consultDur)
            setEditDur(false)
        } finally { setSaving(false) }
    }

    const totalToday = appointments.filter(a => a.doctorId === doctorId && a.date === today)
    const doneCount = totalToday.filter(a => a.status === 'Completed').length
    const scheduledCount = totalToday.filter(a => a.status === 'Scheduled').length

    if (totalToday.length === 0) return null

    return (
        <div style={{ background: '#fff', borderRadius: '14px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '1.5rem' }}>
            {/* Doctor header */}
            <div style={{ background: 'linear-gradient(90deg,#1e3a8a,#2563eb)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>👨‍⚕️</div>
                    <div>
                        <div style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem' }}>{doctorName}</div>
                        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.75rem' }}>{specialization || '—'}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                        { label: `⏳ ${waiting.length} Waiting`, bg: '#f3e8ff', color: '#7c3aed' },
                        { label: `✅ ${doneCount} Done`, bg: '#dcfce7', color: '#16a34a' },
                        { label: `📅 ${scheduledCount} Scheduled`, bg: '#eff6ff', color: '#1e40af' },
                    ].map(b => (
                        <span key={b.label} style={{ background: b.bg, color: b.color, padding: '4px 12px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 800 }}>{b.label}</span>
                    ))}
                </div>
            </div>

            <div style={{ padding: '1rem 1.25rem' }}>

                {/* Consult duration editor */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem', background: '#f8fafc', borderRadius: '10px', padding: '10px 14px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 800, letterSpacing: '0.04em' }}>⏱ CONSULT DURATION:</span>
                    {editDur ? (
                        <>
                            <button onClick={() => setConsultDur(d => Math.max(5, d - 5))} style={{ background: '#e2e8f0', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 800 }}>−</button>
                            <input type="number" min="5" max="120" step="5" value={consultDur}
                                onChange={e => setConsultDur(Math.max(5, parseInt(e.target.value) || 5))}
                                style={{ width: '52px', textAlign: 'center', border: '1.5px solid #2563eb', borderRadius: '6px', padding: '4px', fontWeight: 800, outline: 'none' }} />
                            <button onClick={() => setConsultDur(d => Math.min(120, d + 5))} style={{ background: '#e2e8f0', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 800 }}>+</button>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>min</span>
                            <button onClick={handleSaveDur} disabled={saving}
                                style={{ background: saving ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '7px', padding: '5px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                                {saving ? '⏳' : '⚡ Apply & Recalc'}
                            </button>
                            <button onClick={() => { setEditDur(false); setConsultDur(initDur) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontWeight: 700, fontSize: '0.8rem' }}>Cancel</button>
                        </>
                    ) : (
                        <>
                            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>{consultDur} min</span>
                            <button onClick={() => setEditDur(true)}
                                style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '7px', padding: '4px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>
                                ✏️ Edit
                            </button>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '4px' }}>— changing this recalculates all wait times instantly</span>
                        </>
                    )}
                </div>

                {/* In Consultation */}
                {inConsult && (
                    <div style={{ background: '#e0f2fe', border: '1.5px solid #7dd3fc', borderRadius: '10px', padding: '12px 16px', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                            <div style={{ fontSize: '0.62rem', color: '#0369a1', fontWeight: 800, letterSpacing: '0.06em', marginBottom: '2px' }}>🩺 IN CONSULTATION NOW</div>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>
                                Token #{inConsult.queuePosition ?? '—'} — {inConsult.patientName}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Arrived at {fmt(inConsult.arrivedAt)}</div>
                        </div>
                        <button
                            onClick={() => handleComplete(inConsult)}
                            disabled={spinning === inConsult.id}
                            style={{ background: spinning === inConsult.id ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                            {spinning === inConsult.id ? '⏳' : '✅ Complete'}
                        </button>
                    </div>
                )}

                {/* Waiting queue */}
                {waiting.length === 0 && !inConsult ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem', fontSize: '0.88rem' }}>
                        No patients currently waiting.
                    </div>
                ) : waiting.length === 0 ? null : (
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 800, letterSpacing: '0.06em', marginBottom: '8px' }}>
                            IN QUEUE — {waiting.length} patient{waiting.length !== 1 ? 's' : ''} waiting
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {waiting.map((appt, idx) => (
                                <div key={appt.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 14px', borderRadius: '10px',
                                    background: idx === 0 ? '#f5f3ff' : '#f8fafc',
                                    border: `1.5px solid ${idx === 0 ? '#ddd6fe' : '#f1f5f9'}`,
                                    flexWrap: 'wrap', transition: 'all 0.15s'
                                }}>
                                    {/* Token */}
                                    <span style={{
                                        background: idx === 0 ? '#7c3aed' : '#94a3b8', color: '#fff',
                                        padding: '4px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0
                                    }}>#{appt.queuePosition ?? idx + 1}</span>

                                    {/* Name */}
                                    <span style={{ fontWeight: 700, color: '#1e293b', flex: 1, fontSize: '0.9rem', minWidth: '100px' }}>{appt.patientName}</span>

                                    {/* Arrived */}
                                    <span style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>🕐 {fmt(appt.arrivedAt)}</span>

                                    {/* Wait badge */}
                                    <WaitBadge minutes={appt.waitingTime} />

                                    {/* Before / after */}
                                    <span style={{ fontSize: '0.68rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                        {appt.patientsBefore ?? 0} before · {appt.patientsAfter ?? 0} behind
                                    </span>

                                    {/* Action */}
                                    {idx === 0 && !inConsult && (
                                        <button
                                            onClick={() => handleStart(appt)}
                                            disabled={spinning === appt.id}
                                            style={{ background: spinning === appt.id ? '#94a3b8' : '#0891b2', color: '#fff', border: 'none', borderRadius: '7px', padding: '6px 14px', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                            {spinning === appt.id ? '⏳' : '🩺 Start'}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

/* ─── Main Queue Management Page ─── */
function ReceptionQueue() {
    const [appointments, setAppointments] = useState([])
    const [doctors, setDoctors] = useState({})
    const [trackers, setTrackers] = useState({})
    const [loading, setLoading] = useState(true)
    const today = new Date().toLocaleDateString('en-CA')

    useEffect(() => {
        const q = query(collection(db, 'appointments'), where('date', '==', today))
        const unsubAppts = onSnapshot(q, snap => {
            setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
            setLoading(false)
        })
        const unsubDoctors = onSnapshot(collection(db, 'doctors'), snap => {
            const m = {}
            snap.docs.forEach(d => { m[d.id] = d.data() })
            setDoctors(m)
        })
        const tq = query(collection(db, 'doctorDelayTrackers'), where('date', '==', today), where('active', '==', true))
        const unsubTrackers = onSnapshot(tq, snap => {
            const m = {}
            snap.docs.forEach(d => { m[d.data().doctorId] = { id: d.id, ...d.data() } })
            setTrackers(m)
        })
        return () => { unsubAppts(); unsubDoctors(); unsubTrackers() }
    }, [today])

    // Get unique doctors that have appointments today
    const activeDoctorIds = [...new Set(appointments.map(a => a.doctorId))]

    // Stats
    const totalWaiting = appointments.filter(a => a.status === 'Waiting').length
    const totalInConsult = appointments.filter(a => a.status === 'In Consultation').length
    const totalDone = appointments.filter(a => a.status === 'Completed').length
    const totalScheduled = appointments.filter(a => a.status === 'Scheduled').length

    return (
        <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto', fontFamily: "'Segoe UI', sans-serif" }}>

            {/* Header */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '1.5rem' }}>🟢</span>
                            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#1e293b' }}>Live Queue Management</h1>
                        </div>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.88rem' }}>
                            Real-time per-doctor queue · 📅 {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Stats strip */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {[
                    { icon: '📅', label: 'Scheduled', val: totalScheduled, color: '#64748b', bg: '#f8fafc' },
                    { icon: '⏳', label: 'Waiting', val: totalWaiting, color: '#7c3aed', bg: '#f3e8ff' },
                    { icon: '🩺', label: 'In Consult', val: totalInConsult, color: '#0891b2', bg: '#e0f2fe' },
                    { icon: '✅', label: 'Completed', val: totalDone, color: '#16a34a', bg: '#dcfce7' },
                ].map(s => (
                    <div key={s.label} style={{
                        background: '#fff', borderRadius: '10px', padding: '10px 18px',
                        boxShadow: '0 1px 6px rgba(0,0,0,0.07)', borderTop: `3px solid ${s.color}`,
                        flex: 1, minWidth: '100px', textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '1.2rem', marginBottom: '2px' }}>{s.icon}</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: s.color, lineHeight: 1 }}>{loading ? '—' : s.val}</div>
                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 700, marginTop: '2px', letterSpacing: '0.04em' }}>{s.label.toUpperCase()}</div>
                    </div>
                ))}
            </div>

            {/* Info banner */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 16px', marginBottom: '1.5rem', fontSize: '0.82rem', color: '#1e40af' }}>
                💡 <strong>How it works:</strong> Queue tokens are assigned by physical arrival time.
                Click <strong>🩺 Start</strong> when the doctor calls next patient. Click <strong>✅ Complete</strong> when done — all waiting times recalculate automatically.
                Edit the consultation duration on the spot if a session runs shorter or longer.
            </div>

            {/* Loading / empty */}
            {loading ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem' }}>Loading queue data...</div>
            ) : activeDoctorIds.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem', background: '#fff', borderRadius: '14px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🗓️</div>
                    <h3 style={{ margin: '0 0 4px', color: '#1e293b' }}>No Appointments Today</h3>
                    <p style={{ margin: 0, fontSize: '0.88rem' }}>No patients have been scheduled or checked in for today.</p>
                </div>
            ) : (
                activeDoctorIds.map(doctorId => {
                    const doctor = doctors[doctorId] || {}
                    const tracker = trackers[doctorId] || null
                    // Get doctor name from appointment records if missing in doctors map
                    const doctorName = doctor.name || appointments.find(a => a.doctorId === doctorId)?.doctorName || 'Unknown Doctor'
                    return (
                        <DoctorQueuePanel
                            key={doctorId}
                            doctorId={doctorId}
                            doctorName={doctorName}
                            specialization={doctor.specialization}
                            consultDur={doctor.consultationDuration || 15}
                            tracker={tracker}
                            appointments={appointments}
                            today={today}
                        />
                    )
                })
            )}
        </div>
    )
}

export default ReceptionQueue
