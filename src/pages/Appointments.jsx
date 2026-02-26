import { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import "../styles/Appointments.css";

function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [form, setForm] = useState({
    patientName: "",
    age: "",
    phone: "",
    doctor: "",
    department: "",
    date: "",
    time: "",
    reason: "",
    status: "Scheduled",
  });

  const departments = [
    "General", "Cardiology", "Dermatology",
    "Neurology", "Orthopedics", "Pediatrics",
    "Gynecology", "ENT", "Ophthalmology",
  ];

  const doctors = [
    "Dr. Srinath", "Dr. Haritha", "Dr. Ramesh",
    "Dr. Priya", "Dr. Kumar", "Dr. Anitha",
  ];

  const fetchAppointments = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, "appointments"));
    const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    data.sort((a, b) => new Date(a.date) - new Date(b.date));
    setAppointments(data);
    setLoading(false);
  };

  useEffect(() => { fetchAppointments(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editId) {
      await updateDoc(doc(db, "appointments", editId), form);
    } else {
      await addDoc(collection(db, "appointments"), {
        ...form,
        createdAt: new Date().toISOString(),
      });
    }
    setForm({
      patientName: "", age: "", phone: "",
      doctor: "", department: "", date: "",
      time: "", reason: "", status: "Scheduled",
    });
    setShowForm(false);
    setEditId(null);
    fetchAppointments();
  };

  const handleEdit = (appt) => {
    setForm(appt);
    setEditId(appt.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this appointment?")) {
      await deleteDoc(doc(db, "appointments", id));
      fetchAppointments();
    }
  };

  const handleStatusChange = async (id, status) => {
    await updateDoc(doc(db, "appointments", id), { status });
    fetchAppointments();
  };

  const filtered = appointments.filter((a) => {
    const matchSearch =
      a.patientName?.toLowerCase().includes(search.toLowerCase()) ||
      a.doctor?.toLowerCase().includes(search.toLowerCase()) ||
      a.phone?.includes(search);
    const matchStatus = filterStatus === "All" || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    All: appointments.length,
    Scheduled: appointments.filter((a) => a.status === "Scheduled").length,
    Completed: appointments.filter((a) => a.status === "Completed").length,
    Cancelled: appointments.filter((a) => a.status === "Cancelled").length,
  };

  const statusColor = {
    Scheduled: "badge-blue",
    Completed: "badge-green",
    Cancelled: "badge-red",
  };

  return (
    <div className="main-content">
      {/* HEADER */}
      <div className="page-header">
        <div>
          <h1>📅 Appointments</h1>
          <p>Manage all patient appointments</p>
        </div>
        <button className="btn-add" onClick={() => {
          setShowForm(!showForm);
          setEditId(null);
          setForm({
            patientName: "", age: "", phone: "",
            doctor: "", department: "", date: "",
            time: "", reason: "", status: "Scheduled",
          });
        }}>
          {showForm ? "✖ Close" : "+ New Appointment"}
        </button>
      </div>

      {/* FORM */}
      {showForm && (
        <div className="appt-form-card">
          <h2>{editId ? "✏️ Edit Appointment" : "➕ New Appointment"}</h2>
          <form onSubmit={handleSubmit} className="appt-form">
            <div className="form-row">
              <div className="form-group">
                <label>👤 Patient Name</label>
                <input
                  type="text"
                  placeholder="Full name"
                  value={form.patientName}
                  onChange={(e) => setForm({ ...form, patientName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>🎂 Age</label>
                <input
                  type="number"
                  placeholder="Age"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>📞 Phone</label>
                <input
                  type="tel"
                  placeholder="Phone number"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>🏥 Department</label>
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>👨‍⚕️ Doctor</label>
                <select
                  value={form.doctor}
                  onChange={(e) => setForm({ ...form, doctor: e.target.value })}
                  required
                >
                  <option value="">Select Doctor</option>
                  {doctors.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>📅 Date</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>⏰ Time</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>📋 Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="form-group full-width">
              <label>📝 Reason for Visit</label>
              <input
                type="text"
                placeholder="Reason for visit"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                required
              />
            </div>

            <button type="submit" className="btn-submit">
              {editId ? "✅ Update Appointment" : "✅ Book Appointment"}
            </button>
          </form>
        </div>
      )}

      {/* STATS ROW */}
      <div className="appt-stats">
        {Object.entries(counts).map(([key, val]) => (
          <div
            key={key}
            className={`appt-stat-card ${filterStatus === key ? "active-stat" : ""}`}
            onClick={() => setFilterStatus(key)}
          >
            <h3>{val}</h3>
            <p>{key}</p>
          </div>
        ))}
      </div>

      {/* SEARCH */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="🔍 Search by patient name, doctor, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* TABLE */}
      <div className="appt-table-card">
        {loading ? (
          <div className="table-loading">Loading appointments...</div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">
            <p>📭 No appointments found!</p>
            <p>Click "+ New Appointment" to add one.</p>
          </div>
        ) : (
          <table className="appt-table">
            <thead>
              <tr>
                <th>#</th>
                <th>👤 Patient</th>
                <th>👨‍⚕️ Doctor</th>
                <th>🏥 Department</th>
                <th>📅 Date & Time</th>
                <th>📝 Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((appt, index) => (
                <tr key={appt.id}>
                  <td>{index + 1}</td>
                  <td>
                    <div className="patient-info">
                      <strong>{appt.patientName}</strong>
                      <span>Age: {appt.age} | 📞 {appt.phone}</span>
                    </div>
                  </td>
                  <td>{appt.doctor}</td>
                  <td>{appt.department}</td>
                  <td>
                    <div className="date-time">
                      <strong>{appt.date}</strong>
                      <span>⏰ {appt.time}</span>
                    </div>
                  </td>
                  <td>{appt.reason}</td>
                  <td>
                    <select
                      className={`status-select ${statusColor[appt.status]}`}
                      value={appt.status}
                      onChange={(e) => handleStatusChange(appt.id, e.target.value)}
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn-edit" onClick={() => handleEdit(appt)}>✏️</button>
                      <button className="btn-delete" onClick={() => handleDelete(appt.id)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Appointments;