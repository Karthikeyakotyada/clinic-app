import { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import {
  collection, addDoc, getDocs,
  deleteDoc, doc, updateDoc,
} from "firebase/firestore";
import "../styles/Appointments.css";

const DEPARTMENTS = [
  "General","Cardiology","Dermatology","Neurology",
  "Orthopedics","Pediatrics","Gynecology","ENT","Ophthalmology",
];

const ALL_STATUSES = ["Scheduled","Arrived","Waiting","In Consultation","Completed","Cancelled"];

const STATUS_STYLES = {
  Scheduled:        { bg: "#eff6ff", color: "#2563eb" },
  Arrived:          { bg: "#fef9c3", color: "#ca8a04" },
  Waiting:          { bg: "#f3e8ff", color: "#7c3aed" },
  "In Consultation":{ bg: "#e0f2fe", color: "#0891b2" },
  Completed:        { bg: "#dcfce7", color: "#16a34a" },
  Cancelled:        { bg: "#fee2e2", color: "#dc2626" },
};

const EMPTY_FORM = {
  patientName: "", age: "", phone: "",
  doctorName: "", doctorId: "",
  department: "", date: "", timeSlot: "",
  reason: "", status: "Scheduled",
};

function localToday() {
  const n = new Date();
  return [
    n.getFullYear(),
    String(n.getMonth() + 1).padStart(2,"0"),
    String(n.getDate()).padStart(2,"0"),
  ].join("-");
}

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [editId, setEditId]             = useState(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDate, setFilterDate]     = useState("");
  const [sortOrder, setSortOrder]       = useState("asc"); // asc | desc
  const [saving, setSaving]             = useState(false);

  // ── Fetch all appointments ──────────────────────────────────
  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "appointments"));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => a.date > b.date ? 1 : -1);
      setAppointments(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // ── Fetch real doctors from Firestore ───────────────────────
  const fetchDoctors = async () => {
    try {
      const snap = await getDocs(collection(db, "doctors"));
      setDoctors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchAppointments();
    fetchDoctors();
  }, []);

  // ── Handle doctor selection → auto-fill doctorId ───────────
  const handleDoctorChange = (doctorId) => {
    const doc = doctors.find(d => d.id === doctorId);
    setForm(f => ({
      ...f,
      doctorId:   doctorId,
      doctorName: doc ? doc.name : "",
      department: doc ? doc.specialization : f.department,
    }));
  };

  // ── Submit form (Add / Edit) ────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Strip any stale `id` field from form before saving
      const { id: _id, ...cleanForm } = form;

      if (editId) {
        await updateDoc(doc(db, "appointments", editId), cleanForm);
      } else {
        await addDoc(collection(db, "appointments"), {
          ...cleanForm,
          patientId:  "",   // admin-created — no patient uid
          createdAt:  new Date().toISOString(),
          createdBy:  "admin",
        });
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      setEditId(null);
      fetchAppointments();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  // ── Edit ────────────────────────────────────────────────────
  const handleEdit = (appt) => {
    // Don't include Firestore `id` in the form state
    const { id, ...rest } = appt;
    // Normalize: support both old `time` field and new `timeSlot`
    setForm({
      ...EMPTY_FORM,
      ...rest,
      timeSlot: rest.timeSlot || rest.time || "",
    });
    setEditId(id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this appointment?")) return;
    await deleteDoc(doc(db, "appointments", id));
    fetchAppointments();
  };

  // ── Inline status change ────────────────────────────────────
  const handleStatusChange = async (id, status) => {
    await updateDoc(doc(db, "appointments", id), { status });
    setAppointments(prev =>
      prev.map(a => a.id === id ? { ...a, status } : a)
    );
  };

  // ── Filter + Search ─────────────────────────────────────────
  const filtered = appointments
    .filter(a => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        a.patientName?.toLowerCase().includes(q) ||
        a.doctorName?.toLowerCase().includes(q)  ||
        a.doctor?.toLowerCase().includes(q)      ||
        a.phone?.includes(search)                ||
        a.department?.toLowerCase().includes(q);
      const matchStatus = filterStatus === "All" || a.status === filterStatus;
      const matchDate   = !filterDate || a.date === filterDate;
      return matchSearch && matchStatus && matchDate;
    })
    .sort((a, b) => {
      const diff = a.date > b.date ? 1 : a.date < b.date ? -1 : 0;
      return sortOrder === "asc" ? diff : -diff;
    });

  // ── Counts for stat cards ───────────────────────────────────
  const counts = { All: appointments.length };
  ALL_STATUSES.forEach(s => {
    counts[s] = appointments.filter(a => a.status === s).length;
  });

  // ── Today's appointments ────────────────────────────────────
  const today = localToday();
  const todayCount = appointments.filter(a => a.date === today).length;

  return (
    <div className="main-content">

      {/* ── HEADER ── */}
      <div className="page-header">
        <div>
          <h1>📅 Appointments</h1>
          <p>Manage all patient appointments &nbsp;·&nbsp;
            <span style={{ color: "#2563eb", fontWeight: 700 }}>
              {todayCount} today
            </span>
          </p>
        </div>
        <button className="btn-add" onClick={() => {
          setShowForm(v => !v);
          setEditId(null);
          setForm(EMPTY_FORM);
        }}>
          {showForm ? "✖ Close" : "+ New Appointment"}
        </button>
      </div>

      {/* ── FORM ── */}
      {showForm && (
        <div className="appt-form-card">
          <h2>{editId ? "✏️ Edit Appointment" : "➕ New Appointment"}</h2>
          <form onSubmit={handleSubmit} className="appt-form">

            {/* Row 1 — Patient info */}
            <div className="form-row">
              <div className="form-group">
                <label>👤 Patient Name</label>
                <input type="text" placeholder="Full name" required
                  value={form.patientName}
                  onChange={e => setForm(f => ({ ...f, patientName: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>🎂 Age</label>
                <input type="number" placeholder="Age" min="0" max="150"
                  value={form.age}
                  onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>📞 Phone</label>
                <input type="tel" placeholder="Phone number"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>

            {/* Row 2 — Doctor + Department */}
            <div className="form-row">
              <div className="form-group">
                <label>👨‍⚕️ Doctor</label>
                {doctors.length > 0 ? (
                  <select required value={form.doctorId}
                    onChange={e => handleDoctorChange(e.target.value)}>
                    <option value="">Select Doctor</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} — {d.specialization}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="text" placeholder="Doctor name" required
                    value={form.doctorName}
                    onChange={e => setForm(f => ({ ...f, doctorName: e.target.value }))}
                  />
                )}
              </div>
              <div className="form-group">
                <label>🏥 Department</label>
                <select required value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                  <option value="">Select Department</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3 — Date + Time + Status */}
            <div className="form-row">
              <div className="form-group">
                <label>📅 Date</label>
                <input type="date" required
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>⏰ Time Slot</label>
                <input type="time" required
                  value={form.timeSlot}
                  onChange={e => setForm(f => ({ ...f, timeSlot: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>📋 Status</label>
                <select value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {ALL_STATUSES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 4 — Reason */}
            <div className="form-group full-width">
              <label>📝 Reason for Visit</label>
              <input type="text" placeholder="Reason for visit" required
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>

            <button type="submit" className="btn-submit" disabled={saving}>
              {saving ? "⏳ Saving..." : editId ? "✅ Update Appointment" : "✅ Book Appointment"}
            </button>
          </form>
        </div>
      )}

      {/* ── STAT CARDS ── */}
      <div className="appt-stats" style={{ overflowX: "auto" }}>
        {/* All card */}
        <div
          className={`appt-stat-card ${filterStatus === "All" ? "active-stat" : ""}`}
          onClick={() => setFilterStatus("All")}
        >
          <h3>{counts.All}</h3>
          <p>All</p>
        </div>
        {/* Per-status cards */}
        {ALL_STATUSES.map(s => (
          <div key={s}
            className={`appt-stat-card ${filterStatus === s ? "active-stat" : ""}`}
            onClick={() => setFilterStatus(s)}
            style={{ borderTop: `3px solid ${STATUS_STYLES[s]?.color}` }}
          >
            <h3 style={{ color: STATUS_STYLES[s]?.color }}>{counts[s]}</h3>
            <p style={{ fontSize: "0.78rem" }}>{s}</p>
          </div>
        ))}
      </div>

      {/* ── FILTERS ROW ── */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div className="search-bar" style={{ flex: 1, minWidth: "220px", marginBottom: 0 }}>
          <input
            type="text"
            placeholder="🔍 Search by patient, doctor, phone, dept..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Date filter */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontWeight: 600, fontSize: "0.9rem", whiteSpace: "nowrap" }}>📅 Date:</label>
          <input type="date" value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{ padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "0.9rem" }}
          />
          {filterDate && (
            <button onClick={() => setFilterDate("")}
              style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
              ✕
            </button>
          )}
          {/* Today shortcut */}
          <button onClick={() => setFilterDate(today)}
            style={{ background: filterDate === today ? "#2563eb" : "#eff6ff", color: filterDate === today ? "#fff" : "#2563eb", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
            Today
          </button>
        </div>

        {/* Sort */}
        <button onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")}
          style={{ background: "#f1f5f9", border: "none", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}>
          {sortOrder === "asc" ? "📈 Oldest First" : "📉 Newest First"}
        </button>

        {/* Result count */}
        <span style={{ color: "#94a3b8", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── TABLE ── */}
      <div className="appt-table-card">
        {loading ? (
          <div className="table-loading">⏳ Loading appointments...</div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">
            <p>📭 No appointments found!</p>
            <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
              {search || filterStatus !== "All" || filterDate
                ? "Try clearing your filters."
                : 'Click "+ New Appointment" to add one.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="appt-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>👤 Patient</th>
                  <th>👨‍⚕️ Doctor</th>
                  <th>🏥 Department</th>
                  <th>📅 Date &amp; Time</th>
                  <th>📝 Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((appt, index) => {
                  const style = STATUS_STYLES[appt.status] || STATUS_STYLES["Scheduled"];
                  // Support both old `time` and new `timeSlot` field
                  const timeDisplay = appt.timeSlot || appt.time || "—";
                  const doctorDisplay = appt.doctorName || appt.doctor || "—";
                  return (
                    <tr key={appt.id}
                      style={{ borderLeft: `3px solid ${style.color}`, transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td>{index + 1}</td>
                      <td>
                        <div className="patient-info">
                          <strong>{appt.patientName}</strong>
                          <span>
                            {appt.age ? `Age: ${appt.age}` : ""}
                            {appt.age && appt.phone ? " | " : ""}
                            {appt.phone ? `📞 ${appt.phone}` : ""}
                          </span>
                        </div>
                      </td>
                      <td>{doctorDisplay}</td>
                      <td>{appt.department || "—"}</td>
                      <td>
                        <div className="date-time">
                          <strong>{appt.date}</strong>
                          <span>⏰ {timeDisplay}</span>
                        </div>
                      </td>
                      <td style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {appt.reason || "—"}
                      </td>
                      <td>
                        <select
                          value={appt.status}
                          onChange={e => handleStatusChange(appt.id, e.target.value)}
                          style={{
                            background: style.bg,
                            color: style.color,
                            border: `1px solid ${style.color}`,
                            borderRadius: "20px",
                            padding: "4px 10px",
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            cursor: "pointer",
                            outline: "none",
                          }}
                        >
                          {ALL_STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-edit" title="Edit"
                            onClick={() => handleEdit(appt)}>✏️</button>
                          <button className="btn-delete" title="Delete"
                            onClick={() => handleDelete(appt.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Footer count ── */}
      {!loading && filtered.length > 0 && (
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", textAlign: "right", marginTop: "8px" }}>
          Showing {filtered.length} of {appointments.length} appointments
        </p>
      )}
    </div>
  );
}