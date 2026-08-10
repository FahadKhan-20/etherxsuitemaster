export const AUTH_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  /* Page — solid black background everywhere */
  .auth-page {
    min-height: 100vh;
    min-height: 100dvh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    padding: 24px 16px;
    position: relative;
    background: #000000;
    overflow-x: hidden;
  }

  /* Fixed corner logo */
  .auth-corner-logo {
    position: fixed;
    top: 24px;
    left: 28px;
    width: 140px;
    height: auto;
    z-index: 100;
    filter: drop-shadow(0 2px 12px rgba(212,175,55,0.2));
    pointer-events: none;
  }

  /* Floating close */
  .auth-floating-close {
    position: fixed;
    top: 24px;
    right: 24px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.15s ease;
    z-index: 100;
  }
  .auth-floating-close:hover {
    background: rgba(255,255,255,0.12);
    color: #fff;
    transform: rotate(90deg);
  }

  /* The card */
  .auth-card {
    width: 100%;
    max-width: 440px;
    background: #050505;
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 16px;
    padding: 40px 32px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04) inset;
    position: relative;
    z-index: 10;
  }

  /* Thin gold top accent on card */
  .auth-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 10%;
    right: 10%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(212,175,55,0.35), transparent);
    border-radius: 1px;
  }

  /* Logo inside card */
  .auth-card-logo {
    display: block;
    width: 100px;
    height: auto;
    margin: 0 auto 24px;
    filter: drop-shadow(0 2px 8px rgba(212,175,55,0.15));
  }

  /* Title */
  .auth-form-title {
    font-size: 22px;
    font-weight: 700;
    color: #fff;
    letter-spacing: -0.03em;
    text-align: center;
    margin: 0 0 6px;
  }

  /* Subtitle */
  .auth-form-sub {
    font-size: 13px;
    color: rgba(255,255,255,0.4);
    text-align: center;
    margin: 0 0 26px;
    font-weight: 400;
  }

  /* Social buttons */
  .auth-social-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 16px;
  }

  .auth-social-btn {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 8px;
    color: rgba(255,255,255,0.8);
    padding: 11px 14px;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    min-height: 42px;
  }
  .auth-social-btn:hover {
    background: rgba(255,255,255,0.09);
    border-color: rgba(255,255,255,0.16);
    color: #fff;
  }
  .auth-social-btn:active { opacity: 0.75; }

  /* Divider */
  .auth-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 10.5px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.22);
    margin: 16px 0;
  }
  .auth-divider::before, .auth-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.08);
  }

  /* Form */
  .auth-form { display: flex; flex-direction: column; gap: 12px; }

  .auth-input-wrap { position: relative; width: 100%; }

  .auth-input {
    width: 100%;
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid rgba(255,255,255,0.09) !important;
    border-radius: 8px !important;
    padding: 12px 14px 12px 40px;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    color: #fff !important;
    outline: none;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    min-height: 44px;
  }
  .auth-input::placeholder { color: rgba(255,255,255,0.28); }
  .auth-input:focus {
    background: rgba(255,255,255,0.06) !important;
    border-color: rgba(212,175,55,0.5) !important;
    box-shadow: 0 0 0 3px rgba(212,175,55,0.07) !important;
  }

  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  input:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 1000px #050505 inset !important;
    -webkit-text-fill-color: #fff !important;
    box-shadow: 0 0 0 1000px #050505 inset !important;
    caret-color: #fff !important;
    border: 1px solid rgba(255,255,255,0.09) !important;
    border-radius: 8px !important;
    font-family: 'Inter', sans-serif !important;
    font-size: 14px !important;
    transition: background-color 5000s ease-in-out 0s;
  }

  .auth-input-wrap svg.icon-left {
    position: absolute;
    left: 13px;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(255,255,255,0.3);
    pointer-events: none;
    transition: color 0.15s;
  }
  .auth-input-wrap:focus-within svg.icon-left { color: #d4af37; }

  .auth-eye-btn {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    color: rgba(255,255,255,0.3);
    display: flex;
    align-items: center;
    transition: color 0.15s;
  }
  .auth-eye-btn:hover { color: rgba(255,255,255,0.7); }

  /* Checkbox row */
  .auth-checkbox-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 4px 0;
    gap: 8px;
    flex-wrap: wrap;
  }
  .auth-checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: rgba(255,255,255,0.45);
    cursor: pointer;
    user-select: none;
  }
  .auth-checkbox {
    appearance: none;
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 4px;
    background: rgba(255,255,255,0.04);
    cursor: pointer;
    position: relative;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .auth-checkbox:checked {
    background: #d4af37;
    border-color: #d4af37;
  }
  .auth-checkbox:checked::after {
    content: '';
    position: absolute;
    top: 2px; left: 4px;
    width: 4px; height: 7px;
    border: 1.5px solid #000;
    border-top: none;
    border-left: none;
    transform: rotate(45deg);
  }

  .auth-forgot-link {
    background: none;
    border: none;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,255,255,0.45);
    cursor: pointer;
    padding: 0;
    transition: color 0.15s;
  }
  .auth-forgot-link:hover { color: #fff; }

  /* Alerts */
  .auth-error-box {
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    color: #f87171;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 6px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    line-height: 1.5;
  }
  .auth-success-box {
    background: rgba(16,185,129,0.08);
    border: 1px solid rgba(16,185,129,0.2);
    color: #34d399;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    margin-bottom: 6px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    line-height: 1.5;
  }

  /* CTA Button */
  .auth-cta-btn {
    width: 100%;
    background: #d4af37;
    border: none;
    border-radius: 8px;
    color: #000;
    padding: 13px;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
    cursor: pointer;
    transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
    margin-top: 6px;
    min-height: 46px;
  }
  .auth-cta-btn:hover:not(:disabled) {
    background: #e0bc4a;
    box-shadow: 0 4px 20px rgba(212,175,55,0.25);
    transform: translateY(-1px);
  }
  .auth-cta-btn:active:not(:disabled) { transform: translateY(0); }
  .auth-cta-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* Back */
  .auth-back-btn {
    background: none;
    border: none;
    color: rgba(255,255,255,0.4);
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    cursor: pointer;
    margin-top: 14px;
    transition: color 0.15s;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0;
  }
  .auth-back-btn:hover { color: #fff; }

  /* Footer */
  .auth-footer {
    font-size: 13px;
    color: rgba(255,255,255,0.35);
    margin-top: 24px;
    text-align: center;
  }
  .auth-footer-link {
    color: #d4af37;
    text-decoration: none;
    font-weight: 600;
    transition: color 0.15s;
  }
  .auth-footer-link:hover { color: #e0bc4a; }

  /* Strength bar */
  .auth-strength-bar {
    height: 3px;
    border-radius: 2px;
    background: rgba(255,255,255,0.08);
    margin-top: 8px;
    overflow: hidden;
  }
  .auth-strength-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease, background 0.3s ease;
  }

  /* ── Mobile Responsive Styles ── */
  @media (max-width: 640px) {
    .auth-page {
      padding: 16px 12px;
      align-items: flex-start;
      justify-content: center;
    }
    .auth-card {
      padding: 28px 20px;
      margin-top: 60px;
      border-radius: 14px;
    }
    .auth-corner-logo {
      top: 16px;
      left: 16px;
      width: 105px;
    }
    .auth-floating-close {
      top: 16px;
      right: 16px;
      width: 32px;
      height: 32px;
      font-size: 12px;
    }
    .auth-social-group {
      grid-template-columns: 1fr;
    }
    .auth-form-title {
      font-size: 20px;
    }
    .auth-form-sub {
      margin-bottom: 20px;
    }
  }

  @media (max-width: 380px) {
    .auth-card {
      padding: 24px 16px;
      margin-top: 55px;
    }
    .auth-corner-logo {
      width: 90px;
    }
  }
`;

export function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.19 2.31-.88 3.5-.8 1.56.06 2.89.62 3.77 1.81-3.21 1.95-2.69 6.27.68 7.62-.7 1.68-1.57 3.32-3.03 3.54zm-4.32-15.1c-.2-1.6 1.15-3.13 2.68-3.35.43 1.76-1.16 3.26-2.68 3.35z" />
    </svg>
  );
}

export function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg className="icon-left" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg className="icon-left" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function PersonIcon() {
  return (
    <svg className="icon-left" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function EyeIcon({ open }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
