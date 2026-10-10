import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import apiClient, { getApiErrorMessage } from '../utils/apiClient';
import { isAuthenticated, persistAuthSession } from '../utils/auth';
import { ROUTES } from '../utils/constants';
import { apiBase } from '../utils/apiBase';
import EtherXLogo from '../components/brand/EtherXLogo';
import GoogleMark from '../components/ui/GoogleMark';
import '../styles/auth.css';

const API_BASE = apiBase();
const REMEMBER_KEY = 'etherxmeet_remember_email';
const VALID_EMAIL = /^\S+@\S+\.\S+$/;
const STRENGTH_COLORS = ['var(--c-26231c)', 'var(--c-d8443d)', 'var(--c-d9b54a)', 'var(--c-b5c75a)', 'var(--c-6fcf8f)'];
const passwordScore = (pw) => (!pw ? 0 : [pw.length >= 8, /[A-Z]/.test(pw) && /[a-z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length);
const QUERY_ERRORS = {
  google_auth_failed: 'Google sign-in failed or was cancelled.',
  apple_config_missing: 'Apple sign-in is not available. Use Google or your email.',
  apple_auth_failed: 'Apple sign-in is not available. Use Google or your email.',
};

/** Sign in (/login) and create account (/register) share one page; the link at the bottom switches between them. */
export default function AuthPage({ mode }) {
  const signUp = mode === 'signup';
  const navigate = useNavigate();
  const location = useLocation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_KEY) || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => !!localStorage.getItem(REMEMBER_KEY));
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState(() => QUERY_ERRORS[new URLSearchParams(window.location.search).get('error')] || '');
  const [bad, setBad] = useState(''); // which field the error is about: email | pw | terms
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => { if (isAuthenticated()) navigate(ROUTES.HOME, { replace: true }); }, [navigate]);
  useEffect(() => { setError(''); setBad(''); }, [mode]);

  const score = passwordScore(password);
  const fail = (message, field = '') => { setError(message); setBad(field); };
  const clear = () => { setError(''); setBad(''); };

  const continueWithGoogle = () => {
    if (googleBusy) return;
    if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname)) {
      fail('Google sign-in needs localhost or a registered domain. On a local network address, use email and password.');
      return;
    }
    setGoogleBusy(true);
    window.location.href = `${API_BASE}/api/auth/google`;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const cleanEmail = email.trim();
    if (signUp && !fullName.trim()) return fail('Enter your name.');
    if (!VALID_EMAIL.test(cleanEmail)) return fail('Enter a valid email.', 'email');
    if (signUp && (password.length < 8 || score < 2)) return fail('Use at least 8 characters with a mix of letters and numbers.', 'pw');
    if (!signUp && !password) return fail('Enter your password.', 'pw');
    if (signUp && !terms) return fail('Please accept the Terms to continue.', 'terms');
    setBusy(true);
    clear();
    try {
      const res = signUp
        ? await apiClient.post('/api/auth/register', { name: fullName.trim(), email: cleanEmail, password })
        : await apiClient.post('/api/auth/login', { email: cleanEmail, password });
      if (!res.data?.success) throw new Error(signUp ? 'Could not create your account. Try again.' : 'Sign-in failed. Try again.');
      persistAuthSession({ token: res.data.data.token, user: res.data.data.user });
      if (!signUp) {
        if (remember) localStorage.setItem(REMEMBER_KEY, cleanEmail);
        else localStorage.removeItem(REMEMBER_KEY);
      }
      navigate(location.state?.from || ROUTES.HOME, { replace: true });
    } catch (err) {
      fail(getApiErrorMessage(err, signUp ? 'Could not create your account. Try again.' : 'Invalid email or password.'));
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
          <div className="exm-auth-heading">
            <h1>{signUp ? 'Create your account' : 'Welcome back'}</h1>
            <p>{signUp ? 'Start meeting in seconds.' : 'Sign in to continue to EtherX Meet.'}</p>
          </div>

          <button type="button" className="exm-auth-google" onClick={continueWithGoogle} disabled={googleBusy}>
            {googleBusy ? <span className="exm-auth-spinner" aria-hidden="true" /> : <GoogleMark />}
            <span>{googleBusy ? 'Connecting to Google…' : signUp ? 'Sign up with Google' : 'Continue with Google'}</span>
          </button>

          <div className="exm-auth-or"><span />OR<span /></div>

          <form className="exm-auth-form" onSubmit={submit} noValidate>
            {signUp && (
              <input className="exm-auth-input" value={fullName} onChange={(e) => { setFullName(e.target.value); clear(); }} placeholder="Full name" autoComplete="name" aria-label="Full name" />
            )}
            <input
              className="exm-auth-input" type="email" value={email} placeholder="Email" autoComplete="email" aria-label="Email"
              data-bad={bad === 'email'} aria-invalid={bad === 'email'}
              onChange={(e) => { setEmail(e.target.value); clear(); }}
            />
            <div className="exm-auth-password">
              <input
                className="exm-auth-input" type={showPassword ? 'text' : 'password'} value={password} placeholder="Password" aria-label="Password"
                autoComplete={signUp ? 'new-password' : 'current-password'} data-bad={bad === 'pw'} aria-invalid={bad === 'pw'}
                onChange={(e) => { setPassword(e.target.value); clear(); }}
              />
              <button type="button" onClick={() => setShowPassword((on) => !on)} title={showPassword ? 'Hide password' : 'Show password'} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="M3 3l18 18" />}</svg>
              </button>
            </div>

            {signUp && (
              <div className="exm-auth-strength" aria-hidden="true">
                {[1, 2, 3, 4].map((i) => <span key={i} style={{ background: i <= score ? STRENGTH_COLORS[score] : STRENGTH_COLORS[0] }} />)}
              </div>
            )}

            {error && <p className="exm-auth-error" role="alert">{error}</p>}

            {!signUp && (
              <div className="exm-auth-row">
                <button type="button" className="exm-auth-check" onClick={() => setRemember((on) => !on)} aria-pressed={remember}>
                  <Tick on={remember} />Remember me
                </button>
                <Link className="exm-auth-link-muted" to={ROUTES.FORGOT_PASSWORD} state={{ email: email.trim() }}>Forgot password?</Link>
              </div>
            )}

            <button type="submit" className="exm-auth-submit" disabled={busy}>
              {busy && <span className="exm-auth-spinner" aria-hidden="true" />}
              <span>{busy ? (signUp ? 'Creating account…' : 'Signing in…') : signUp ? 'Create account' : 'Sign in'}</span>
            </button>

            {signUp && (
              <div className="exm-auth-check exm-auth-terms">
                <button type="button" className="exm-auth-tick" onClick={() => { setTerms((on) => !on); clear(); }} aria-pressed={terms} aria-label="I agree to the Terms and Privacy Policy">
                  <Tick on={terms} bad={bad === 'terms'} />
                </button>
                <span>I agree to the <PolicyLinks /></span>
              </div>
            )}
          </form>

          <p className="exm-auth-switch">
            {signUp ? 'Already have an account?' : 'New to EtherX?'}{' '}
            <Link to={signUp ? ROUTES.LOGIN : ROUTES.REGISTER} state={location.state}>{signUp ? 'Sign in' : 'Create an account'}</Link>
          </p>
        </div>
      </main>

      {!signUp && <footer className="exm-auth-footer">By continuing you agree to the <PolicyLinks /></footer>}
    </div>
  );
}

function PolicyLinks() {
  return (
    <>
      <Link to={ROUTES.TERMS} target="_blank" rel="noopener noreferrer">Terms</Link> and{' '}
      <Link to={ROUTES.PRIVACY} target="_blank" rel="noopener noreferrer">Privacy Policy</Link>
    </>
  );
}

function Tick({ on, bad }) {
  return (
    <span className="exm-auth-box" data-on={on} data-bad={!!bad}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
    </span>
  );
}
