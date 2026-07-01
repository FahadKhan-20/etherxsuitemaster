import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import apiClient, { getApiErrorMessage } from '../utils/apiClient'
import { persistAuthSession, isAuthenticated } from '../utils/auth'
import etherxLogo from '../assets/etherx_transparent.png'
import { AUTH_CSS, AppleIcon, GoogleIcon, MailIcon, LockIcon, EyeIcon } from './authShared'

const defaultBaseUrl = typeof window !== 'undefined'
  ? window.location.origin
  : 'http://localhost:5000';

const API_BASE = import.meta.env.VITE_API_BASE_URL || defaultBaseUrl;

export default function Login() {
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe]     = useState(false)
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [isForgotMode, setIsForgotMode] = useState(false)
  const [forgotEmail, setForgotEmail]   = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState('')
  const [forgotError, setForgotError]     = useState('')

  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated()) { navigate('/', { replace: true }); return }
    const saved = localStorage.getItem('etherxmeet_remember_email')
    if (saved) { setEmail(saved); setRememberMe(true) }
  }, [navigate])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)
    try {
      const res = await apiClient.post('/api/auth/login', { email, password })
      if (res.data.success) {
        persistAuthSession({ token: res.data.data.token, user: res.data.data.user })
        if (rememberMe) localStorage.setItem('etherxmeet_remember_email', email)
        else localStorage.removeItem('etherxmeet_remember_email')
        navigate('/', { replace: true })
        return
      }
      setError('Login failed. Please try again.')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid email or password.'))
    }
    setLoading(false)
  }

  const handleForgotSubmit = async (e) => {
    e.preventDefault()
    setForgotError('')
    setForgotSuccess('')
    if (!forgotEmail) { setForgotError('Please enter your email.'); return }
    setForgotLoading(true)
    try {
      const res = await apiClient.post('/api/auth/forgot-password', { email: forgotEmail })
      if (res.data.success) {
        setForgotSuccess(res.data.message || 'Reset link sent. Check your inbox.')
        setForgotEmail('')
      } else {
        setForgotError(res.data.message || 'Failed to send reset link.')
      }
    } catch (err) {
      setForgotError(getApiErrorMessage(err, 'Failed to send reset request.'))
    }
    setForgotLoading(false)
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
        <AnimatePresence mode="wait">
          {!isForgotMode ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="auth-form-title">Sign in</h2>
              <p className="auth-form-sub">Welcome back.</p>

               <div className="auth-social-group">
                <button className="auth-social-btn" onClick={() => {
                  window.alert('Apple sign-in is not configured. Please use Email & Password.');
                }}>
                  <AppleIcon /> Apple
                </button>
                <button className="auth-social-btn" onClick={() => {
                  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                    window.alert('Google OAuth redirects require localhost. For mobile network testing, please sign in with your Email & Password.');
                    return;
                  }
                  window.location.href = `${API_BASE}/api/auth/google`;
                }}>
                  <GoogleIcon /> Google
                </button>
              </div>

              <div className="auth-divider">or</div>

              {error && (
                <div className="auth-error-box"><span>⚠</span> {error}</div>
              )}

              <form onSubmit={handleLogin} className="auth-form">
                <div className="auth-input-wrap">
                  <MailIcon />
                  <input className="auth-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>

                <div className="auth-input-wrap">
                  <LockIcon />
                  <input className="auth-input" type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ paddingRight: '42px' }} autoComplete="current-password" />
                  <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                    <EyeIcon open={showPassword} />
                  </button>
                </div>

                <div className="auth-checkbox-row">
                  <label className="auth-checkbox-label">
                    <input type="checkbox" className="auth-checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                    Remember me
                  </label>
                  <button type="button" className="auth-forgot-link" onClick={() => { setIsForgotMode(true); setError('') }}>
                    Forgot password?
                  </button>
                </div>

                <button type="submit" disabled={loading} className="auth-cta-btn">
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <p className="auth-footer">
                No account? <Link to="/register" className="auth-footer-link">Sign up</Link>
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="auth-form-title">Reset password</h2>
              <p className="auth-form-sub" style={{ marginBottom: 20 }}>We'll send a reset link to your email.</p>

              {forgotSuccess && <div className="auth-success-box"><span>✓</span> {forgotSuccess}</div>}
              {forgotError   && <div className="auth-error-box"><span>⚠</span> {forgotError}</div>}

              <form onSubmit={handleForgotSubmit} className="auth-form">
                <div className="auth-input-wrap">
                  <MailIcon />
                  <input className="auth-input" type="email" placeholder="Email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required autoFocus />
                </div>
                <button type="submit" disabled={forgotLoading} className="auth-cta-btn">
                  {forgotLoading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <button className="auth-back-btn" onClick={() => { setIsForgotMode(false); setForgotError(''); setForgotSuccess('') }}>
                ← Back
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
