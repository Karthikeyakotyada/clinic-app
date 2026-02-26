import { useState } from "react";
import { auth } from "../firebase/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import "../styles/Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError("Invalid email or password!");
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">

      {/* LEFT SIDE */}
      <div className="login-left">
        <div className="login-left-content">
          <div className="hospital-icon">🏥</div>
          <h1>ClinicCare</h1>
          <p>Smart Healthcare Management System</p>
          <div className="features-list">
            <div className="feature-item">📅 Appointment Scheduling</div>
            <div className="feature-item">🧪 Lab Report Delivery</div>
            <div className="feature-item">📦 Inventory Management</div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="login-right">
        <div className="login-box">
          <div className="login-header">
            <h2>Welcome Back 👋</h2>
            <p>Sign in to your account</p>
          </div>

          {error && <div className="error-msg">⚠️ {error}</div>}

          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>📧 Email Address</label>
              <input
                type="email"
                placeholder="doctor@clinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label>🔒 Password</label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="login-btn"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In →"}
            </button>
          </form>

          <div className="login-footer">
            <p>🔐 Secure & HIPAA Compliant</p>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Login;