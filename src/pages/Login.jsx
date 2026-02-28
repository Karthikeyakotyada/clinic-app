import { useState } from 'react'
import { auth, db } from '../firebase/firebase'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import '../styles/Login.css'

const ROLES = [
  { value: 'patient', label: '🧑 Patient', desc: 'Book appointments & view prescriptions' },
  { value: 'doctor', label: '👨‍⚕️ Doctor', desc: 'Manage appointments & prescriptions' },
  { value: 'reception', label: '🗂️ Reception', desc: 'Manage all appointments & arrivals' },
]

const SPECIALIZATIONS = [
  'General', 'Cardiology', 'Dermatology', 'Neurology',
  'Orthopedics', 'Pediatrics', 'Gynecology', 'ENT', 'Ophthalmology',
]

function Login() {
  const [tab, setTab] = useState('login')

  // Login state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [showLoginPwd, setShowLoginPwd] = useState(false)

  // Signup state
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirm, setSignupConfirm] = useState('')
  const [signupRole, setSignupRole] = useState('patient')
  const [signupSpec, setSignupSpec] = useState('')
  const [signupError, setSignupError] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [showSignupPwd, setShowSignupPwd] = useState(false)

  // ── LOGIN ──
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword)
    } catch (err) {
      const msg =
        err.code === 'auth/user-not-found' ? 'No account found with this email.' :
          err.code === 'auth/wrong-password' ? 'Incorrect password. Try again.' :
            err.code === 'auth/invalid-credential' ? 'Invalid email or password.' :
              err.code === 'auth/too-many-requests' ? 'Too many attempts. Try again later.' :
                'Login failed. Please try again.'
      setLoginError(msg)
      setLoginLoading(false)
    }
  }

  // ── SIGNUP ──
  const handleSignup = async (e) => {
    e.preventDefault()
    setSignupError('')

    // Validations
    if (signupName.trim().length < 2) {
      setSignupError('Please enter your full name (at least 2 characters).')
      return
    }
    if (signupRole === 'doctor' && !signupSpec) {
      setSignupError('Please select your specialization.')
      return
    }
    if (signupPassword.length < 6) {
      setSignupError('Password must be at least 6 characters.')
      return
    }
    if (signupPassword !== signupConfirm) {
      setSignupError('Passwords do not match.')
      return
    }

    setSignupLoading(true)
    try {
      // Step 1: Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, signupEmail, signupPassword)
      const user = userCredential.user

      // Step 2: Update display name
      await updateProfile(user, { displayName: signupName.trim() })

      // Step 3: Save user role to Firestore BEFORE auth state fires redirect
      // This is critical — AuthContext listens via onSnapshot, so it will
      // pick up the role immediately after this write
      await setDoc(doc(db, 'users', user.uid), {
        name: signupName.trim(),
        email: signupEmail,
        role: signupRole,
        createdAt: new Date().toISOString(),
      })

      // Step 4: If doctor → also create doctors profile doc
      if (signupRole === 'doctor') {
        await setDoc(doc(db, 'doctors', user.uid), {
          name: signupName.trim(),
          email: signupEmail,
          specialization: signupSpec,
          bio: '',
          phone: '',
          consultationDuration: 30,
          photoURL: '',
          createdAt: new Date().toISOString(),
        })
      }

      // Step 5: Show success — AuthContext will auto-redirect via onSnapshot
      setSignupSuccess(true)
    } catch (err) {
      const msg =
        err.code === 'auth/email-already-in-use' ? 'This email is already registered. Please sign in.' :
          err.code === 'auth/invalid-email' ? 'Invalid email address.' :
            err.code === 'auth/weak-password' ? 'Password is too weak (min 6 characters).' :
              'Signup failed. Please try again.'
      setSignupError(msg)
      setSignupLoading(false)
    }
  }

  const switchTab = (t) => {
    setTab(t)
    setLoginError('')
    setSignupError('')
    setSignupSuccess(false)
  }

  return (
    <div className="login-wrapper">

      {/* ── LEFT PANEL ── */}
      <div className="login-left">
        <div className="login-left-content">
          <span className="hospital-icon">🏥</span>
          <h1>ClinicCare</h1>
          <p>Smart Healthcare Management System</p>
          <div className="features-list">
            <div className="feature-item">📅 Online Appointment Booking</div>
            <div className="feature-item">👨‍⚕️ Doctor Availability Scheduling</div>
            <div className="feature-item">💊 Digital Prescriptions</div>
            <div className="feature-item">🗂️ Reception Management</div>
            <div className="feature-item">⏳ Real-time Waiting Time</div>
          </div>
        </div>
        <div className="login-left-badge">🔐 SECURE &amp; HIPAA COMPLIANT</div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="login-right">
        <div className="login-box">

          {/* Mini brand inside card */}
          <div className="login-box-brand">
            <span>🏥</span>
            <span>ClinicCare</span>
          </div>

          {/* Tabs */}
          <div className="auth-tabs">
            <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => switchTab('login')}>Sign In</button>
            <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => switchTab('signup')}>Sign Up</button>
          </div>

          {/* ══ LOGIN FORM ══ */}
          {tab === 'login' && (
            <>
              <div className="login-header">
                <h2>Welcome Back 👋</h2>
                <p>Sign in to your ClinicCare account</p>
              </div>

              {loginError && <div className="error-msg">⚠️ {loginError}</div>}

              <form onSubmit={handleLogin}>
                <div className="input-group">
                  <label>📧 Email Address</label>
                  <input
                    type="email" placeholder="you@clinic.com"
                    value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required
                  />
                </div>

                <div className="input-group">
                  <label>🔒 Password</label>
                  <div className="password-wrapper">
                    <input
                      type={showLoginPwd ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required
                    />
                    <button type="button" className="toggle-password" onClick={() => setShowLoginPwd(p => !p)}>
                      {showLoginPwd ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <button type="submit" className="login-btn" disabled={loginLoading}>
                  {loginLoading ? 'Signing in...' : 'Sign In →'}
                </button>
              </form>

              <div className="login-footer">
                <p>Don&apos;t have an account?{' '}
                  <button className="link-btn" onClick={() => switchTab('signup')}>Sign Up</button>
                </p>
                <p style={{ marginTop: '8px' }}>🔐 Secure &amp; HIPAA Compliant</p>
              </div>
            </>
          )}

          {/* ══ SIGNUP FORM ══ */}
          {tab === 'signup' && (
            <>
              <div className="login-header">
                <h2>Create Account ✨</h2>
                <p>Join ClinicCare today</p>
              </div>

              {signupSuccess ? (
                <div className="success-msg">
                  <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🎉</div>
                  <h3>Account Created!</h3>
                  <p>Welcome to ClinicCare! Redirecting to your portal...</p>
                </div>
              ) : (
                <>
                  {signupError && <div className="error-msg">⚠️ {signupError}</div>}

                  <form onSubmit={handleSignup}>

                    {/* Role Selection */}
                    <div className="input-group">
                      <label>👤 I am a...</label>
                      <div className="role-selector">
                        {ROLES.map(r => (
                          <div
                            key={r.value}
                            className={`role-card ${signupRole === r.value ? 'selected' : ''}`}
                            onClick={() => { setSignupRole(r.value); setSignupSpec('') }}
                          >
                            <span className="role-label">{r.label}</span>
                            <span className="role-desc">{r.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Doctor Specialization — shown ONLY when role = doctor */}
                    {signupRole === 'doctor' && (
                      <div className="input-group">
                        <label>🏥 Specialization <span style={{ color: '#dc2626' }}>*</span></label>
                        <select
                          value={signupSpec}
                          onChange={e => setSignupSpec(e.target.value)}
                          required
                          style={{
                            width: '100%', padding: '11px 14px',
                            border: `2px solid ${signupSpec ? '#2563eb' : '#e2e8f0'}`,
                            borderRadius: '8px', fontSize: '14px',
                            outline: 'none', cursor: 'pointer',
                            background: '#fff', boxSizing: 'border-box',
                          }}
                        >
                          <option value="">-- Select your specialization --</option>
                          {SPECIALIZATIONS.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        {!signupSpec && (
                          <p style={{ color: '#f59e0b', fontSize: '0.8rem', margin: '4px 0 0', fontWeight: 500 }}>
                            ⚠️ Required for doctors
                          </p>
                        )}
                      </div>
                    )}

                    {/* Full Name */}
                    <div className="input-group">
                      <label>🙍 Full Name</label>
                      <input
                        type="text" placeholder="Your full name"
                        value={signupName} onChange={e => setSignupName(e.target.value)} required
                      />
                    </div>

                    {/* Email */}
                    <div className="input-group">
                      <label>📧 Email Address</label>
                      <input
                        type="email" placeholder="you@clinic.com"
                        value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required
                      />
                    </div>

                    {/* Password Row */}
                    <div className="form-row-two">
                      <div className="input-group">
                        <label>🔒 Password</label>
                        <div className="password-wrapper">
                          <input
                            type={showSignupPwd ? 'text' : 'password'}
                            placeholder="Min 6 characters"
                            value={signupPassword} onChange={e => setSignupPassword(e.target.value)} required
                          />
                          <button type="button" className="toggle-password" onClick={() => setShowSignupPwd(p => !p)}>
                            {showSignupPwd ? '🙈' : '👁️'}
                          </button>
                        </div>
                      </div>

                      <div className="input-group">
                        <label>🔒 Confirm Password</label>
                        <div className="password-wrapper">
                          <input
                            type={showSignupPwd ? 'text' : 'password'}
                            placeholder="Repeat password"
                            value={signupConfirm} onChange={e => setSignupConfirm(e.target.value)} required
                          />
                          {signupConfirm && (
                            <span className="password-match-icon">
                              {signupPassword === signupConfirm ? '✅' : '❌'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Password strength hint */}
                    {signupPassword && (
                      <div style={{ marginTop: '-10px', marginBottom: '14px' }}>
                        <div style={{ height: '4px', borderRadius: '4px', background: '#e2e8f0', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '4px', transition: 'width 0.3s',
                            width: signupPassword.length >= 10 ? '100%' : signupPassword.length >= 6 ? '60%' : '30%',
                            background: signupPassword.length >= 10 ? '#16a34a' : signupPassword.length >= 6 ? '#f59e0b' : '#dc2626'
                          }} />
                        </div>
                        <p style={{ fontSize: '0.75rem', margin: '3px 0 0', color: signupPassword.length >= 10 ? '#16a34a' : signupPassword.length >= 6 ? '#f59e0b' : '#dc2626' }}>
                          {signupPassword.length >= 10 ? 'Strong password' : signupPassword.length >= 6 ? 'Moderate password' : 'Weak password'}
                        </p>
                      </div>
                    )}

                    <button type="submit" className="login-btn" disabled={signupLoading}>
                      {signupLoading ? 'Creating Account...' : 'Create Account →'}
                    </button>
                  </form>

                  <div className="login-footer">
                    <p>Already have an account?{' '}
                      <button className="link-btn" onClick={() => switchTab('login')}>Sign In</button>
                    </p>
                  </div>
                </>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}

export default Login