import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import apiClient, { getApiErrorMessage } from '../utils/apiClient'
import { persistAuthSession, isAuthenticated } from '../utils/auth'
import etherxLogo from '../assets/etherx_transparent.png'
import { AUTH_CSS, AppleIcon, GoogleIcon, PersonIcon, MailIcon, LockIcon, EyeIcon } from './authShared'

const defaultBaseUrl = typeof window !== 'undefined'
  ? window.location.origin
  : 'http://localhost:5000';

const API_BASE = import.meta.env.VITE_API_BASE_URL || defaultBaseUrl;

function getStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' }
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return [
    { score: 0, label: '', color: '' },
    { score: 1, label: 'Weak',   color: '#ef4444' },
    { score: 2, label: 'Fair',   color: '#f59e0b' },
    { score: 3, label: 'Good',   color: '#3b82f6' },
    { score: 4, label: 'Strong', color: '#22c55e' },
  ][s]
}

export default function Register() {
  const [name, setName]                 = useState('')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)

  const navigate = useNavigate()
  const strength = getStrength(password)

  useEffect(() => {
    if (isAuthenticated()) navigate('/', { replace: true })
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name || !email || !password) { setError('Please fill in all fields.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    try {
      const res = await apiClient.post('/api/auth/register', { name, email, password })
      if (res.data.success) {
        persistAuthSession({ token: res.data.data.token, user: res.data.data.user })
        navigate('/', { replace: true })
        return
      }
      setError('Registration failed. Please try again.')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Cannot connect to server.'))
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <style>{AUTH_CSS}</style>

      {/* 140px fixed corner logo */}
      <img src={etherxLogo} alt="EtherXMeet" className="auth-corner-logo" />

      {/* Close */}
      <button className="auth-floating-close" onClick={() => navigate('/')} title="Close">✕</button>

      {/* Black card */}
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className="auth-form-title">Create account</h2>
        <p className="auth-form-sub">Get started for free.</p>

        <div className="auth-social-group">
          <button className="auth-social-btn" onClick={() => {
            window.alert('Apple sign-in is not configured. Please use Email & Password.');
          }}>
            <AppleIcon /> Apple
          </button>
          <button className="auth-social-btn" onClick={() => {
            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
              window.alert('Google OAuth redirects require localhost. For mobile network testing, please register using your Email & Password.');
              return;
            }
            window.location.href = `${API_BASE}/api/auth/google`;
          }}>
            <GoogleIcon /> Google
          </button>
        </div>

        <div className="auth-divider">or</div>

        {error && <div className="auth-error-box"><span>⚠</span> {error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-input-wrap">
            <PersonIcon />
            <input className="auth-input" type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
          </div>

          <div className="auth-input-wrap">
            <MailIcon />
            <input className="auth-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>

          <div>
            <div className="auth-input-wrap">
              <LockIcon />
              <input className="auth-input" type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingRight: '42px' }} autoComplete="new-password" />
              <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                <EyeIcon open={showPassword} />
              </button>
            </div>
            {password.length > 0 && (
              <div>
                <div className="auth-strength-bar">
                  <div className="auth-strength-fill" style={{ width: `${(strength.score / 4) * 100}%`, background: strength.color }} />
                </div>
                <div style={{ fontSize: 11, color: strength.color, marginTop: 5, fontWeight: 500 }}>
                  {strength.label}
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="auth-cta-btn">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-footer">
          Have an account? <Link to="/login" className="auth-footer-link">Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}
