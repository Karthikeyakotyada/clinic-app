import { Link, useLocation } from 'react-router-dom'
import { auth } from '../firebase/firebase'
import { signOut } from 'firebase/auth'
import { useAuth } from '../context/AuthContext'
import { useSidebar } from '../context/SidebarContext'
import '../styles/Navbar.css'

/* ── Three-line hamburger icon ── */
function HamburgerLines() {
  return (
    <>
      <span />
      <span />
      <span />
    </>
  )
}

function Navbar() {
  const { user, userRole } = useAuth()
  const { open, toggle } = useSidebar()
  const location = useLocation()

  const handleLogout = async () => { await signOut(auth) }

  const doctorLinks = [
    { path: '/doctor/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/doctor/appointments', icon: '📅', label: 'Appointments' },
    { path: '/doctor/availability', icon: '🗓️', label: 'Availability' },
    { path: '/doctor/prescriptions', icon: '💊', label: 'Prescriptions' },
    { path: '/doctor/profile', icon: '👤', label: 'Profile' },
  ]
  const patientLinks = [
    { path: '/patient/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/patient/book', icon: '➕', label: 'Book Appointment' },
    { path: '/patient/appointments', icon: '📅', label: 'My Appointments' },
    { path: '/patient/prescriptions', icon: '💊', label: 'Prescriptions' },
    { path: '/patient/medical-records', icon: '🗂️', label: 'Medical Records' },
    { path: '/patient/profile', icon: '👤', label: 'Profile' },
  ]
  const receptionLinks = [
    { path: '/reception/dashboard', icon: '📊', label: 'Dashboard' },
    { path: '/reception/appointments', icon: '📋', label: 'All Appointments' },
    { path: '/reception/queue', icon: '🟢', label: 'Queue Mgmt' },
    { path: '/reception/schedule', icon: '🗓️', label: 'Schedule' },
    { path: '/reception/doctors', icon: '👨‍⚕️', label: 'Doctors' },
    { path: '/reception/doctor-delay', icon: '⏰', label: 'Doctor Delay' },
    { path: '/reception/announcements', icon: '📢', label: 'Announcements' },
  ]

  const navItems =
    userRole === 'doctor' ? doctorLinks :
      userRole === 'patient' ? patientLinks :
        userRole === 'reception' ? receptionLinks :
          [
            { path: '/dashboard', icon: '📊', label: 'Dashboard' },
            { path: '/appointments', icon: '📅', label: 'Appointments' },
            { path: '/lab-reports', icon: '🧪', label: 'Lab Reports' },
            { path: '/inventory', icon: '📦', label: 'Inventory' },
          ]

  const roleLabel =
    userRole === 'doctor' ? '👨‍⚕️ Doctor' :
      userRole === 'patient' ? '🧑 Patient' :
        userRole === 'reception' ? '🗂️ Reception' : 'Admin'

  return (
    <>
      {/* ── Floating hamburger trigger (visible when sidebar is closed) ── */}
      <button
        className={`hamburger-trigger${open ? ' hidden' : ''}`}
        onClick={toggle}
        title="Open sidebar"
        aria-label="Open navigation sidebar"
      >
        <HamburgerLines />
      </button>

      {/* ── Sidebar ── */}
      <div className={`navbar${open ? '' : ' collapsed'}`}>

        {/* Logo row + close button */}
        <div className="navbar-logo">
          <span className="logo-icon">🏥</span>
          <span className="logo-text">ClinicCare</span>
          {/* Hamburger (close) inside open sidebar */}
          <button
            className="sidebar-close-btn"
            onClick={toggle}
            title="Close sidebar"
            aria-label="Close navigation sidebar"
          >
            <HamburgerLines />
          </button>
        </div>

        {/* Nav links */}
        <nav className="navbar-links">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="navbar-bottom">
          {/* Queue Board quick-launch for Reception */}
          {userRole === 'reception' && (
            <a
              href="/queue-display"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px', padding: '8px 12px',
                color: '#fff', textDecoration: 'none',
                fontSize: '0.78rem', fontWeight: 600,
                marginBottom: '0.6rem',
                transition: 'background 0.2s',
              }}
            >
              <span>📺</span>
              <span>Queue Board</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.62rem', opacity: 0.6 }}>↗️</span>
            </a>
          )}

          <div className="user-info">
            <div className="user-avatar">👤</div>
            <div className="user-details">
              <p className="user-email">{user?.email}</p>
              <p className="user-role">{roleLabel}</p>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>🚪 Logout</button>
        </div>
      </div>
    </>
  )
}

export default Navbar