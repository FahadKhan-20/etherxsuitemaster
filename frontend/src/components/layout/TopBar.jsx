import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Copy,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MoreVertical,
  Settings,
  UserRound,
} from 'lucide-react';
import Dropdown from '../ui/Dropdown';
import { useMeeting } from '../../context/MeetingContext';
import { useUser } from '../../context/UserContext';
import { useWallet } from '../../context/WalletContext';
import { ROUTES } from '../../utils/constants';
import { clearAuthSession, getUserInitials } from '../../utils/auth';
import etherxLogo from '../../assets/etherx_transparent.png';

function buildMeetingCode(meetingId) {
  if (!meetingId) {
    return 'ETHX-ROOM';
  }

  const normalized = meetingId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (normalized.length <= 4) {
    return `ETHX-${normalized}`;
  }

  return normalized.match(/.{1,4}/g)?.slice(0, 3).join('-') || normalized;
}

function buildWeatherLabel(hour) {
  if (hour >= 18 || hour < 6) {
    return '24°C Clear';
  }

  if (hour >= 12) {
    return '29°C Bright';
  }

  return '26°C Calm';
}

export default function TopBar({ showMeetingInfo = false }) {
  const navigate = useNavigate();
  const { logout } = useWallet();
  const { user } = useUser();
  const { meetingId, meetingTitle, startTime } = useMeeting();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const timezone = user.timezone || 'UTC';

  const elapsedTime = useMemo(() => {
    const seconds = Math.max(0, Math.floor((now - startTime) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
    }

    return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  }, [now, startTime]);

  const localClock = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        timeZone: timezone,
      }).format(now),
    [now, timezone],
  );

  const currentHour = useMemo(
    () =>
      Number(
        new Intl.DateTimeFormat('en-US', {
          hour: '2-digit',
          hour12: false,
          timeZone: timezone,
        }).format(now),
      ),
    [now, timezone],
  );

  const weatherLabel = useMemo(() => buildWeatherLabel(currentHour), [currentHour]);
  const meetingCode = useMemo(() => buildMeetingCode(meetingId), [meetingId]);
  const userInitials = useMemo(() => getUserInitials(user.name), [user.name]);

  const copyMeetingLink = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/room/${meetingId || 'etherx'}`);
  };

  const handleLogout = async () => {
    // Await the Web3Auth SDK teardown before clearing the app session and
    // navigating away — otherwise the full-page navigation below can race
    // the in-flight async disconnect, leaving a lingering Web3Auth session
    // that re-hydrates on the next /login visit and strands the user behind
    // a permanently-disabled sign-in button.
    await logout();
    clearAuthSession();
    window.location.replace(ROUTES.LOGIN);
  };

  const meetingOptions = [
    {
      label: 'Copy Invite Link',
      icon: <Copy className="h-4 w-4" />,
      onClick: copyMeetingLink,
    },
    {
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
      onClick: () => navigate(ROUTES.DASHBOARD),
    },
    {
      label: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      onClick: () => navigate(ROUTES.SETTINGS),
    },
    {
      label: 'Logout',
      icon: <LogOut className="h-4 w-4" />,
      onClick: handleLogout,
    },
  ];

  const userOptions = meetingOptions.filter((option) => option.label !== 'Copy Invite Link');
  const logoutButton = (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white/70 transition-all duration-300 hover:text-[#d4af37] bg-transparent border-none cursor-pointer"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Logout</span>
    </button>
  );

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 40, borderBottom: '1px solid rgba(212,175,55,0.08)', background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(16px)', fontFamily: "'Inter', sans-serif" }}>
      <div 
        style={{ margin: '0 auto', display: 'flex', maxWidth: '1680px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '10px 14px' }}
      >
        <button
          onClick={() => navigate(ROUTES.HOME)}
          style={{ display: 'flex', minWidth: 0, alignItems: 'center', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
        >
          <EtherxMark />
        </button>

        {showMeetingInfo ? (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <div className="hidden md:flex gap-2">
              <TopChip
                eyebrow="Meeting"
                value={meetingTitle || 'ETHERX Board Review'}
                detail={`Elapsed ${elapsedTime}`}
              />
              <TopChip eyebrow="Local Time" value={localClock} />
              <TopChip eyebrow="Weather" value={weatherLabel} />
            </div>

            <button
              onClick={copyMeetingLink}
              className="flex items-center gap-2 sm:gap-3 rounded-[16px] sm:rounded-[20px] border border-white/10 bg-white/[0.04] px-2.5 sm:px-4 py-1.5 sm:py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-300 hover:border-[#d4af37]/30"
              title="Copy invite link"
            >
              <div className="text-left">
                <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-white/40">Code</p>
                <p className="text-xs sm:text-sm font-medium text-white">{meetingCode}</p>
              </div>
              <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#d4af37]" />
            </button>

            <IconShell title="Secure room">
              <LockKeyhole className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#d4af37]" />
            </IconShell>

            <Dropdown
              position="bottom-right"
              trigger={
                <IconShell title="Meeting options">
                  <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/72" />
                </IconShell>
              }
              items={meetingOptions}
            />

            {logoutButton}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="hidden sm:block" style={{ textAlign: 'right', paddingRight: '4px' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#f0e6d3' }}>{user.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#a89878', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{user.plan}</p>
            </div>

            <Dropdown
              position="bottom-right"
              trigger={
                <button 
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#f0e6d3', transition: 'color 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#d4af37'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#f0e6d3'}
                >
                  <div style={{ display: 'flex', height: '32px', width: '32px', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'linear-gradient(135deg,#d4af37,#b8860b)', fontSize: '12px', fontWeight: 700, color: '#0a0a0a' }}>
                    {userInitials}
                  </div>
                  <UserRound size={14} style={{ opacity: 0.7 }} />
                </button>
              }
              items={userOptions}
            />

            <button
              type="button"
              onClick={handleLogout}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#f0e6d3', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'Sora', sans-serif" }}
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function EtherxMark() {
  return (
    <img
      src={etherxLogo}
      alt="EtherX Meet"
      style={{ width: 'clamp(125px, 28vw, 160px)', height: 'auto', display: 'block' }}
    />
  );
}



function TopChip({ eyebrow, value, detail }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <p className="text-[10px] uppercase tracking-[0.24em] text-white/38">{eyebrow}</p>
      <p className="mt-0.5 text-sm font-medium text-white">{value}</p>
      {detail ? <p className="mt-0.5 text-xs text-white/45">{detail}</p> : null}
    </div>
  );
}

function IconShell({ children, title }) {
  return (
    <button
      className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-[18px] border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-300 hover:border-[#d4af37]/30 hover:text-[#d4af37]"
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}
