import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Film, House, LayoutDashboard, Moon, Settings, Sun } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { useWallet } from '../../context/WalletContext';
import { clearAuthSession, getUserInitials } from '../../utils/auth';
import { ROUTES } from '../../utils/constants';
import { useTheme } from '../../utils/theme';
import Dropdown from '../ui/Dropdown';
import ProfileAvatar from '../ui/ProfileAvatar';
import EtherXLogo from '../brand/EtherXLogo';
import './workspace-header.css';

export default function WorkspaceHeader() {
  const { user } = useUser();
  const { logout } = useWallet();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [now, setNow] = useState(Date.now());
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const { resolved: theme, setTheme } = useTheme();
  const isHome = pathname === ROUTES.HOME;
  const LinkIcon = isHome ? LayoutDashboard : House;
  const linkLabel = isHome ? 'Dashboard' : 'Home';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setError('');
    try {
      await logout();
      clearAuthSession();
      window.location.replace(ROUTES.LOGIN);
    } catch {
      setError('Could not sign out. Try again.');
      setLoggingOut(false);
    }
  };

  return (
    <header className="workspace-header">
      <button type="button" className="workspace-brand" aria-label="EtherX Meet home" onClick={() => navigate(ROUTES.HOME)}>
        <EtherXLogo className="workspace-logo" />
      </button>
      <div className="workspace-header-controls">
        <span className="workspace-clock">{new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
        <button type="button" className="workspace-nav-button" onClick={() => navigate(isHome ? ROUTES.DASHBOARD : ROUTES.HOME)} aria-label={linkLabel}><LinkIcon size={14} aria-hidden="true" /><span>{linkLabel}</span></button>
        <button type="button" className="workspace-theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'} title={theme === 'light' ? 'Dark theme' : 'Light theme'}>{theme === 'light' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}</button>
        <button type="button" className="workspace-logout" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? 'Signing out…' : 'Logout'}</button>
        <Dropdown position="bottom-right" items={[
          { label: 'Recordings', icon: <Film size={16} />, onClick: () => navigate(ROUTES.RECORDINGS) },
          { label: 'Analytics', icon: <BarChart3 size={16} />, onClick: () => navigate(ROUTES.ANALYTICS) },
          { label: 'Settings', icon: <Settings size={16} />, onClick: () => navigate(ROUTES.SETTINGS) },
        ]} trigger={
          <button type="button" className="workspace-account" aria-label="Account menu">
            <ProfileAvatar src={user.avatar} name={user.name} initials={getUserInitials(user.name).charAt(0) || '?'} className="workspace-avatar" />
          </button>
        } />
      </div>
      {error && <p className="workspace-header-error" role="alert">{error}</p>}
    </header>
  );
}
