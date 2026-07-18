import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import apiClient, { getApiErrorMessage } from '../utils/apiClient'
import { persistAuthSession, isAuthenticated } from '../utils/auth'
import { useWallet } from '../context/WalletContext'
import etherxLogo from '../assets/etherx_transparent.png'
import { AUTH_CSS } from './authShared'

// Web3Auth's connectorName resolves to the literal string 'auth' for every
// social/email login (google, email_passwordless, discord alike), so it
// can't distinguish which sub-method was used. The sub-method instead lives
// on userInfo.authConnection, whose values ('google', 'email_passwordless',
// 'discord', etc. — see @toruslabs/customauth's AUTH_CONNECTION enum)
// already match our authProvider enum 1:1. External-wallet connectors
// (MetaMask etc.) never populate authConnection at all, so anything not in
// the known list — including undefined — falls back to 'wallet'. This is a
// display label only (not a security boundary — the backend independently
// verifies the idToken), so a generous mapping here is safe.
const VALID_AUTH_PROVIDERS = ['google', 'email_passwordless', 'discord', 'wallet'];
function toAuthProvider(authConnection) {
  return VALID_AUTH_PROVIDERS.includes(authConnection) ? authConnection : 'wallet';
}

export default function Login() {
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login, userInfo } = useWallet()

  useEffect(() => {
    if (isAuthenticated()) { navigate('/', { replace: true }) }
  }, [navigate])

  const handleSignIn = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await login()
      if (!result) {
        // User closed the modal without completing login — not an error.
        setLoading(false)
        return
      }
      const { idToken, walletAddress, authConnection } = result
      const res = await apiClient.post('/api/auth/web3auth', {
        idToken,
        walletAddress,
        avatar: userInfo?.profileImage || null,
        loginMethod: toAuthProvider(authConnection),
      })
      if (res.data.success) {
        persistAuthSession({ token: res.data.data.token, user: res.data.data.user })
        navigate('/', { replace: true })
        return
      }
      setError('Sign-in failed. Please try again.')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Sign-in failed. Please try again.'))
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <style>{AUTH_CSS}</style>
      <img src={etherxLogo} alt="EtherXMeet" className="auth-corner-logo" />

      <AnimatePresence mode="wait">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
        >
          <img src={etherxLogo} alt="EtherXMeet" className="auth-card-logo" />
          <h1 className="auth-form-title">Welcome to EtherXMeet</h1>
          <p className="auth-form-sub">Sign in with Google, email, Discord, or your own wallet</p>

          {error && (
            <div className="auth-error-box">
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            className="auth-cta-btn"
            onClick={handleSignIn}
            disabled={loading || isAuthenticated()}
          >
            {loading ? 'Signing in…' : isAuthenticated() ? 'Signed in' : 'Sign in'}
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
