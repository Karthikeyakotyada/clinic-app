import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { auth } from './firebase/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Appointments from './pages/Appointments'
import LabReports from './pages/LabReports'
import Inventory from './pages/Inventory'
import Navbar from './components/Navbar'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-spinner">🏥</div>
      <p>Loading ClinicCare...</p>
    </div>
  )

  return (
    <BrowserRouter>
      {user && <Navbar user={user} />}
      <Routes>
        <Route path="/" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />
        <Route path="/appointments" element={user ? <Appointments /> : <Navigate to="/" />} />
        <Route path="/lab-reports" element={user ? <LabReports /> : <Navigate to="/" />} />
        <Route path="/inventory" element={user ? <Inventory /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App