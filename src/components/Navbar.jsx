import { Link, useLocation } from 'react-router-dom'
import { auth } from '../firebase/firebase'
import { signOut } from 'firebase/auth'
import '../styles/Navbar.css'

function Navbar({ user }) {
  const location = useLocation()

  const handleLogout = async () => {
    await signOut(auth)
  }

  const navItems = [
    { path: '/dashboard',    icon: '📊', label: 'Dashboard'    },
    { path: '/appointments', icon: '📅', label: 'Appointments'  },
    { path: '/lab-reports',  icon: '🧪', label: 'Lab Reports'   },
    { path: '/inventory',    icon: '📦', label: 'Inventory'     },
  ]

  return (
    <div className="navbar">
      <div className="navbar-logo">
        <span className="logo-icon">🏥</span>
        <span className="logo-text">ClinicCare</span>
      </div>

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

      <div className="navbar-bottom">
        <div className="user-info">
          <div className="user-avatar">👤</div>
          <div className="user-details">
            <p className="user-email">{user.email}</p>
            <p className="user-role">Admin</p>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          🚪 Logout
        </button>
      </div>
    </div>
  )
}

export default Navbar