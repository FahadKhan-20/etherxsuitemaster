import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import apiClient, { getApiErrorMessage } from '../utils/apiClient';
import { ROUTES } from '../utils/constants';
import EtherXLogo from '../components/brand/EtherXLogo';
import '../styles/auth.css';

const VALID_EMAIL = /^\S+@\S+\.\S+$/;

/** Asks for the account email and sends a one-hour reset link (the link opens /reset-password/:token). */
export default function ForgotPassword() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (event) => {
    event?.preventDefault();
    const address = email.trim();
    if (!VALID_EMAIL.test(address)) { setError('Enter the email you sign in with.'); return; }
    setBusy(true);
    setError('');
    try {
      await apiClient.post('/api/auth/forgot-password', { email: address });
      setSentTo(address);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send the reset link. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="exm-auth">
      <header className="exm-auth-header">
        <Link to={ROUTES.LOGIN} aria-label="EtherX Meet home"><EtherXLogo className="exm-auth-logo" /></Link>
      </header>

      <main className="exm-auth-main">
        <div className="exm-auth-panel">
          {sentTo ? (
            <>
              <div className="exm-auth-heading">
                <h1>Check your email</h1>
                <p>If an account uses <strong>{sentTo}</strong>, a reset link is on its way. It works for one hour. Check spam if it does not arrive in a few minutes.</p>
              </div>
              <div className="exm-auth-form">
                {error && <p className="exm-auth-error" role="alert">{error}</p>}
                <button type="button" className="exm-auth-submit" onClick={send} disabled={busy}>
                  {busy && <span className="exm-auth-spinner" aria-hidden="true" />}
                  <span>{busy ? 'Sending…' : 'Send the link again'}</span>
                </button>
                <button type="button" className="exm-auth-secondary" onClick={() => { setSentTo(''); setError(''); }}>Use a different email</button>
              </div>
            </>
          ) : (
            <>
              <div className="exm-auth-heading">
                <h1>Reset your password</h1>
                <p>Enter the email you sign in with and we will send you a link to choose a new password.</p>
              </div>
              <form className="exm-auth-form" onSubmit={send} noValidate>
                <input
                  className="exm-auth-input" type="email" value={email} placeholder="Email" autoComplete="email" aria-label="Email" autoFocus
                  data-bad={!!error} aria-invalid={!!error} onChange={(e) => { setEmail(e.target.value); setError(''); }}
                />
                {error && <p className="exm-auth-error" role="alert">{error}</p>}
                <button type="submit" className="exm-auth-submit" disabled={busy}>
                  {busy && <span className="exm-auth-spinner" aria-hidden="true" />}
                  <span>{busy ? 'Sending…' : 'Send reset link'}</span>
                </button>
              </form>
            </>
          )}
          <p className="exm-auth-switch">Remembered it? <Link to={ROUTES.LOGIN}>Back to sign in</Link></p>
        </div>
      </main>
    </div>
  );
}
