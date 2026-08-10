import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import axios from 'axios'
import etherxLogo from '../assets/etherx_transparent.png'

const C = {
  bg:               '#141414',
  surface:          '#111313',
  border:           '#2a2a2a',
  borderFocus:      '#d4af37',
  onBackground:     '#e5e1e4',
  onSurfaceVariant: '#9a9a9a',
  gold:             '#d4af37',
  goldShadow:       '#b8860b',
  error:            '#ffb4ab',
  errorCont:        'rgba(147,0,10,0.35)',
  success:          '#6fcf97',
  successCont:      'rgba(16,80,40,0.4)',
}

export default function ResetPassword() {
  const { token } = useParams()
  const navigate  = useNavigate()

  const [password, setPassword]           = useState('')
  const [confirm, setConfirm]             = useState('')
  const [showPassword, setShowPassword]   = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)
  const [passFocused, setPassFocused]     = useState(false)
  const [confFocused, setConfFocused]     = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState(false)
  const [loading, setLoading]             = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!password || !confirm) { setError('Please fill in both fields.'); return }
    if (password.length < 6)   { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm)   { setError('Passwords do not match.'); return }

    setLoading(true)
    try {
      const res = await axios.post(`/api/auth/reset-password/${token}`, { password })
      if (res.data.success) {
        setSuccess(true)
        setTimeout(() => navigate('/login'), 3000)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Link is invalid or has expired.')
    }
    setLoading(false)
  }

  return (
    <>
      <style>{`
        .rp-glow { background: radial-gradient(circle at center top, rgba(212,175,55,0.10) 0%, rgba(20,20,20,0) 60%); }
        .rp-submit:hover:not(:disabled) { background: ${C.goldShadow} !important; color: #eedca0 !important; }
        .rp-input::placeholder { color: ${C.onSurfaceVariant}; }
      `}</style>

      <div style={s.page}>
        <div className="rp-glow" style={s.glow} />
        <div style={s.logoCorner}>
          <img src={etherxLogo} alt="EtherXMeet" style={s.logoImg} />
        </div>

        <div style={s.center}>
          <motion.div
            style={s.container}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <h1 style={s.title}>Set a new password</h1>
              <p style={s.subtitle}>Choose a strong password for your EtherXMeet account.</p>
            </div>

            {/* Success state */}
            {success ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={s.successBox}
              >
                <span style={{ marginRight: 8 }}>✓</span>
                Password reset successfully! Redirecting to login…
              </motion.div>
            ) : (
              <>
                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={s.errorBox}
                  >
                    <span style={{ marginRight: 6 }}>⚠</span>{error}
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} style={s.form}>
                  {/* New password */}
                  <div style={{ position: 'relative', width: '100%' }}>
                    <span className="material-symbols-outlined" style={s.inputIcon}>lock</span>
                    <input
                      className="rp-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="New password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setPassFocused(true)}
                      onBlur={() => setPassFocused(false)}
                      style={{
                        ...s.input,
                        paddingRight: 48,
                        borderColor: passFocused ? C.borderFocus : C.border,
                        boxShadow: passFocused ? `0 0 0 1px ${C.borderFocus}` : 'none',
                      }}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} style={s.eyeBtn} tabIndex={-1}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: C.onSurfaceVariant }}>
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>

                  {/* Confirm password */}
                  <div style={{ position: 'relative', width: '100%' }}>
                    <span className="material-symbols-outlined" style={s.inputIcon}>lock_reset</span>
                    <input
                      className="rp-input"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Confirm new password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      onFocus={() => setConfFocused(true)}
                      onBlur={() => setConfFocused(false)}
                      style={{
                        ...s.input,
                        paddingRight: 48,
                        borderColor: confFocused ? C.borderFocus : C.border,
                        boxShadow: confFocused ? `0 0 0 1px ${C.borderFocus}` : 'none',
                      }}
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)} style={s.eyeBtn} tabIndex={-1}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: C.onSurfaceVariant }}>
                        {showConfirm ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="rp-submit"
                    style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }}
                  >
                    {loading ? 'Resetting…' : 'Reset Password'}
                  </button>
                </form>
              </>
            )}

            <p style={s.footerText}>
              <Link to="/login" style={s.footerLink}>Back to Login</Link>
            </p>
          </motion.div>
        </div>
      </div>
    </>
  )
}

const s = {
  page: {
    minHeight: '100vh',
    background: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Inter, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },
  logoCorner: {
    position: 'fixed',
    top: 20,
    left: 24,
    zIndex: 10,
    background: 'none',
  },
  logoImg: {
    height: 130,
    width: 'auto',
    display: 'block',
    background: 'none',
  },
  glow: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 0,
  },
  center: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 24px',
    position: 'relative',
    zIndex: 1,
  },
  container: {
    width: '100%',
    maxWidth: 480,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 32,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
    color: C.onBackground,
    margin: '0 0 8px',
  },
  subtitle: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
    color: C.onSurfaceVariant,
    margin: 0,
  },
  errorBox: {
    width: '100%',
    background: C.errorCont,
    border: '1px solid rgba(255,180,171,0.3)',
    color: C.error,
    padding: '10px 14px',
    borderRadius: 8,
    fontFamily: 'Inter, sans-serif',
    fontSize: 13,
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1.45,
    boxSizing: 'border-box',
  },
  successBox: {
    width: '100%',
    background: C.successCont,
    border: '1px solid rgba(111,207,151,0.3)',
    color: C.success,
    padding: '14px 16px',
    borderRadius: 8,
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1.5,
    boxSizing: 'border-box',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    top: '50%',
    transform: 'translateY(-50%)',
    color: C.onSurfaceVariant,
    fontSize: 20,
    pointerEvents: 'none',
    userSelect: 'none',
    fontVariationSettings: "'FILL' 0",
  },
  input: {
    width: '100%',
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '12px 16px 12px 48px',
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
    color: C.onBackground,
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
  },
  submitBtn: {
    width: '100%',
    background: C.gold,
    color: C.bg,
    border: 'none',
    borderRadius: 8,
    padding: '13px 16px',
    fontFamily: 'Inter, sans-serif',
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: '0.03em',
    cursor: 'pointer',
    marginTop: 4,
    transition: 'background 0.15s, color 0.15s, opacity 0.15s',
  },
  footerText: {
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
    marginTop: 24,
    textAlign: 'center',
  },
  footerLink: {
    color: C.gold,
    textDecoration: 'underline',
    fontWeight: 500,
  },
}
