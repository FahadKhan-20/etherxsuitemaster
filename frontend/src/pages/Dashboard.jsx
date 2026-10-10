import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown, ArrowUpRight, BarChart3, CalendarClock, CalendarDays, Check,
  Clock3, Film, RefreshCw, Repeat2, Trash2, Video, X,
} from 'lucide-react';
import AnimatedPage from '../components/layout/AnimatedPage';
import WorkspaceHeader from '../components/layout/WorkspaceHeader';
import Scheduler from '../components/features/Scheduler';
import { useSchedules } from '../hooks/useSchedules';
import { nextStart } from '../components/layout/MeetingReminders';
import { useUser } from '../context/UserContext';
import { scheduleTimezone } from '../utils/scheduleValidation';
import { ROUTES } from '../utils/constants';
import '../styles/dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { meetings, create, remove, error, loading, reload } = useSchedules();
  const [showScheduler, setShowScheduler] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const timezone = scheduleTimezone(user.timezone);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const upcoming = useMemo(() => meetings
    .map((meeting) => ({
      ...meeting,
      next: nextStart({ startAt: meeting.date, duration: meeting.duration, recurring: meeting.recurring }, now),
    }))
    .filter((meeting) => meeting.next !== null)
    .sort((a, b) => a.next - b.next), [meetings, now]);
  const visibleMeetings = showAll ? upcoming : upcoming.slice(0, 4);
  const plannedHours = (meetings.reduce((sum, meeting) => sum + (meeting.duration || 0), 0) / 60).toFixed(1);
  const formatDate = (date, options) => new Intl.DateTimeFormat(undefined, { timeZone: timezone, ...options }).format(date);

  const openRoom = (roomCode) => {
    sessionStorage.setItem('etherx_host_room', roomCode);
    sessionStorage.setItem('etherx_meet_start', String(Date.now()));
    navigate(`/room/${roomCode}`);
  };

  const deleteMeeting = async (id) => {
    setDeletingId(id);
    await remove(id);
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  return (
    <AnimatedPage>
      <div className="dashboard-page">
        <a className="dashboard-skip-link" href="#dashboard-content">Skip to content</a>
        <WorkspaceHeader />
        <main className="dashboard-content" id="dashboard-content">
          <div className="dashboard-heading">
            <h1>Dashboard</h1>
            <div className="dashboard-actions">
              <button className="dashboard-button dashboard-button-secondary" onClick={() => navigate(ROUTES.RECORDINGS)}>
                <Film size={18} aria-hidden="true" /> Recordings
              </button>
              <button className="dashboard-button dashboard-button-secondary" onClick={() => navigate(ROUTES.ANALYTICS)}>
                <BarChart3 size={18} aria-hidden="true" /> Analytics
              </button>
              <button className="dashboard-button dashboard-button-secondary" onClick={() => setShowScheduler(true)}>
                <CalendarClock size={18} aria-hidden="true" /> Schedule
              </button>
              <button className="dashboard-button dashboard-button-primary" onClick={() => openRoom(user.roomSlug)}>
                <Video size={18} aria-hidden="true" /> Open my room
                <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          {!loading && !error && meetings.length > 0 && (
            <section className="dashboard-stats" aria-label="Schedule summary">
              <div className="dashboard-stat">
                <CalendarDays size={20} aria-hidden="true" />
                <div><span>Meetings scheduled</span><strong>{meetings.length}</strong></div>
              </div>
              <div className="dashboard-stat">
                <Clock3 size={20} aria-hidden="true" />
                <div><span>Hours planned</span><strong>{plannedHours}h</strong></div>
              </div>
            </section>
          )}

          <section className="dashboard-panel" aria-labelledby="dashboard-sessions-title" aria-busy={loading}>
            <div className="dashboard-panel-heading">
              <h2 id="dashboard-sessions-title">Upcoming meetings</h2>
              {!loading && !error && upcoming.length > 0 && <span className="dashboard-count">{upcoming.length}</span>}
            </div>
            {error ? (
              <div className="dashboard-error">
                <p role="alert">{error}</p>
                <button type="button" onClick={reload} disabled={loading}><RefreshCw size={16} aria-hidden="true" />Retry</button>
              </div>
            ) : loading ? (
              <p className="dashboard-empty" role="status">Loading your meetings…</p>
            ) : upcoming.length === 0 ? (
              <p className="dashboard-empty">No upcoming meetings.</p>
            ) : (
              <ul className="dashboard-meeting-list">
                {visibleMeetings.map((meeting) => (
                  <li key={meeting.id} className="dashboard-meeting-row">
                    <div className="dashboard-date-tile" aria-hidden="true">
                      <span>{formatDate(meeting.next, { month: 'short' })}</span>
                      <strong>{formatDate(meeting.next, { day: 'numeric' })}</strong>
                    </div>
                    <div className="dashboard-meeting-info">
                      <h3>{meeting.title}</h3>
                      <p>
                        <time dateTime={new Date(meeting.next).toISOString()}>{formatDate(meeting.next, { hour: 'numeric', minute: '2-digit' })}</time>
                        <span>·</span>{meeting.duration} min<span>·</span>{meeting.participants.length} invited
                      </p>
                      {meeting.recurring && meeting.recurring !== 'none' && (
                        <span className="dashboard-repeat"><Repeat2 size={13} aria-hidden="true" />Repeats {meeting.recurring}</span>
                      )}
                    </div>
                    <div className="dashboard-meeting-actions">
                      {confirmDeleteId === meeting.id ? (
                        <>
                          <span className="dashboard-delete-label">Delete?</span>
                          <button className="dashboard-icon-button dashboard-delete" disabled={deletingId === meeting.id} aria-label={`Confirm delete ${meeting.title}`} onClick={() => deleteMeeting(meeting.id)}><Check size={17} /></button>
                          <button className="dashboard-icon-button" disabled={deletingId === meeting.id} aria-label="Cancel delete" onClick={() => setConfirmDeleteId(null)}><X size={17} /></button>
                        </>
                      ) : (
                        <>
                          <button className="dashboard-icon-button dashboard-delete" aria-label={`Delete ${meeting.title}`} onClick={() => setConfirmDeleteId(meeting.id)}><Trash2 size={17} /></button>
                          <button className="dashboard-join-button" onClick={() => openRoom(meeting.roomCode)} aria-label={`Join ${meeting.title}`}>Join<ArrowUpRight size={16} aria-hidden="true" /></button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!error && upcoming.length > 4 && (
              <button className="dashboard-show-all" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Show fewer meetings' : `View all ${upcoming.length} meetings`}
                <ArrowDown size={15} className={showAll ? 'is-expanded' : ''} aria-hidden="true" />
              </button>
            )}
            {!error && upcoming.length > 0 && <p className="dashboard-timezone">Times shown in {timezone.replaceAll('_', ' ')}</p>}
          </section>
        </main>
        <Scheduler isOpen={showScheduler} onClose={() => setShowScheduler(false)} onSchedule={create} />
      </div>
    </AnimatedPage>
  );
}
