import { useEffect, useState } from "react";
import { db } from "../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";
import "../styles/Dashboard.css";

function Dashboard() {
  const [appointments, setAppointments] = useState(0);
  const [labReports, setLabReports] = useState(0);
  const [inventory, setInventory] = useState(0);
  const [expiredItems, setExpiredItems] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const appointSnap = await getDocs(collection(db, "appointments"));
        const labSnap = await getDocs(collection(db, "labReports"));
        const invSnap = await getDocs(collection(db, "inventory"));

        setAppointments(appointSnap.size);
        setLabReports(labSnap.size);
        setInventory(invSnap.size);

        // Count expired items
        const today = new Date();
        let expired = 0;
        invSnap.forEach((doc) => {
          const expiry = new Date(doc.data().expiryDate);
          if (expiry < today) expired++;
        });
        setExpiredItems(expired);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchStats();
  }, []);

  const stats = [
    {
      icon: "📅",
      label: "Total Appointments",
      value: appointments,
      color: "#2563eb",
      bg: "#eff6ff",
    },
    {
      icon: "🧪",
      label: "Lab Reports",
      value: labReports,
      color: "#16a34a",
      bg: "#f0fdf4",
    },
    {
      icon: "📦",
      label: "Inventory Items",
      value: inventory,
      color: "#d97706",
      bg: "#fffbeb",
    },
    {
      icon: "⚠️",
      label: "Expired Items",
      value: expiredItems,
      color: "#dc2626",
      bg: "#fef2f2",
    },
  ];

  return (
    <div className="main-content">
      {/* HEADER */}
      <div className="dashboard-header">
        <div>
          <h1>📊 Dashboard</h1>
          <p>Welcome back! Here's what's happening today.</p>
        </div>
        <div className="date-badge">
          📅 {new Date().toDateString()}
        </div>
      </div>

      {/* STAT CARDS */}
      {loading ? (
        <div className="dashboard-loading">Loading stats...</div>
      ) : (
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <div
              className="stat-card"
              key={index}
              style={{ borderTop: `4px solid ${stat.color}` }}
            >
              <div className="stat-icon" style={{ background: stat.bg }}>
                {stat.icon}
              </div>
              <div className="stat-info">
                <h3 style={{ color: stat.color }}>{stat.value}</h3>
                <p>{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QUICK ACTIONS */}
      <div className="quick-actions">
        <h2>⚡ Quick Actions</h2>
        <div className="actions-grid">
          <a href="/appointments" className="action-card blue">
            <span>📅</span>
            <p>New Appointment</p>
          </a>
          <a href="/lab-reports" className="action-card green">
            <span>🧪</span>
            <p>Upload Lab Report</p>
          </a>
          <a href="/inventory" className="action-card orange">
            <span>📦</span>
            <p>Add Medicine</p>
          </a>
        </div>
      </div>

      {/* INFO CARDS */}
      <div className="info-grid">
        <div className="info-card">
          <h3>🏥 About ClinicCare</h3>
          <p>Smart system to manage appointments, lab reports, and inventory for small clinics and labs.</p>
        </div>
        <div className="info-card">
          <h3>📌 Today's Summary</h3>
          <ul>
            <li>✅ {appointments} Appointments booked</li>
            <li>✅ {labReports} Lab reports uploaded</li>
            <li>✅ {inventory} Medicine items tracked</li>
            <li>{expiredItems > 0 ? `⚠️ ${expiredItems} items expired!` : "✅ No expired items"}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;