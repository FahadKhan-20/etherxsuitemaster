import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Download, Film, Play, RefreshCw, Search, Share2, Trash2, Video, X } from 'lucide-react';
import AnimatedPage from '../components/layout/AnimatedPage';
import WorkspaceHeader from '../components/layout/WorkspaceHeader';
import apiClient, { getApiErrorMessage } from '../utils/apiClient';
import { copyMeetingText } from '../utils/meetingClipboard';
import { apiBase } from '../utils/apiBase';
import { ROUTES } from '../utils/constants';
import '../styles/dashboard.css';
import '../styles/recordings.css';

const API = apiBase();

// Recording durations are stored in seconds.
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, sec = String(Math.round(seconds) % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};
const formatSize = (bytes) => (!bytes ? '' : bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`);
const formatDate = (value, options) => new Date(value).toLocaleString([], options);

export default function Recordings() {
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [playUrl, setPlayUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState('');
  const [actionError, setActionError] = useState('');
  const playerRef = useRef(null);

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await apiClient.get('/api/recordings');
      setRecordings((res.data?.data?.recordings ?? []).map((r) => ({
        id: r._id,
        title: r.originalName?.replace(/\.[^.]+$/, '') || r.roomCode,
        roomCode: r.roomCode,
        duration: r.duration || 0,
        size: r.size || 0,
        date: r.createdAt,
      })));
    } catch (error) {
      // Keep whatever was shown before; say the load failed instead of looking like an empty library.
      setLoadError(getApiErrorMessage(error, 'Could not load your recordings.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { fetchRecordings(); }, [fetchRecordings]);

  // Signed, expiring link from the backend: <video> and downloads cannot send the Authorization header.
  const recordingLink = async (recording, share = false) => {
    const res = await apiClient.post(`/api/recordings/${recording.id}/link`, { share });
    return `${API}${res.data.url}`;
  };

  const play = async (recording) => {
    setSelected(recording);
    setPlayUrl('');
    setActionError('');
    setBusy(`play-${recording.id}`);
    try {
      setPlayUrl(await recordingLink(recording));
      requestAnimationFrame(() => playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Could not open this recording.'));
    } finally {
      setBusy('');
    }
  };

  const download = async (recording) => {
    setActionError('');
    setBusy(`download-${recording.id}`);
    try {
      const a = document.createElement('a');
      a.href = `${await recordingLink(recording)}&download=1`;
      a.download = `${recording.title}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Could not download this recording.'));
    } finally {
      setBusy('');
    }
  };

  // Copies a link anyone can play for 7 days (deleting the recording revokes it).
  const share = async (recording) => {
    setActionError('');
    setBusy(`share-${recording.id}`);
    try {
      await copyMeetingText(await recordingLink(recording, true));
      setCopiedId(recording.id);
      setTimeout(() => setCopiedId((id) => (id === recording.id ? '' : id)), 2500);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Could not create a share link.'));
    } finally {
      setBusy('');
    }
  };

  // Deleting removes the file and voids every play, download and share link.
  const remove = async (recording) => {
    setActionError('');
    setBusy(`delete-${recording.id}`);
    try {
      await apiClient.delete(`/api/recordings/${recording.id}`);
      setRecordings((list) => list.filter((r) => r.id !== recording.id));
      if (selected?.id === recording.id) { setSelected(null); setPlayUrl(''); }
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Could not delete this recording.'));
    } finally {
      setBusy('');
      setConfirmDeleteId('');
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recordings.filter((r) => !q || r.title.toLowerCase().includes(q) || r.roomCode?.toLowerCase().includes(q));
  }, [query, recordings]);

  const totalSeconds = recordings.reduce((sum, r) => sum + r.duration, 0);

  return (
    <AnimatedPage>
      <div className="dashboard-page">
        <WorkspaceHeader />
        <main className="dashboard-content">
          <div className="dashboard-heading">
            <h1>Recordings</h1>
            <div className="dashboard-actions rec-tools">
              <label className="rec-search">
                <Search size={16} aria-hidden="true" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or room code" aria-label="Search recordings" />
              </label>
              <button type="button" className="dashboard-icon-button" onClick={fetchRecordings} disabled={loading} title="Refresh" aria-label="Refresh recordings">
                <RefreshCw size={16} className={loading ? 'rec-spin' : ''} aria-hidden="true" />
              </button>
            </div>
          </div>

          {recordings.length > 0 && (
            <section className="dashboard-stats" aria-label="Recording summary">
              <div className="dashboard-stat"><Film size={20} aria-hidden="true" /><div><span>Recordings</span><strong>{recordings.length}</strong></div></div>
              <div className="dashboard-stat"><Video size={20} aria-hidden="true" /><div><span>Total length</span><strong>{formatDuration(totalSeconds)}</strong></div></div>
            </section>
          )}

          {selected && (
            <section ref={playerRef} className="dashboard-panel rec-player" aria-label={`Playing ${selected.title}`}>
              <div className="dashboard-panel-heading">
                <h2>{selected.title}</h2>
                <button type="button" className="dashboard-icon-button rec-close" onClick={() => { setSelected(null); setPlayUrl(''); }} aria-label="Close player"><X size={16} aria-hidden="true" /></button>
              </div>
              <div className="rec-stage">
                {playUrl ? (
                  <video src={playUrl} controls autoPlay playsInline />
                ) : (
                  <button type="button" className="dashboard-join-button" onClick={() => play(selected)} disabled={busy === `play-${selected.id}`}>
                    <Play size={16} aria-hidden="true" />{busy === `play-${selected.id}` ? 'Opening…' : 'Play recording'}
                  </button>
                )}
              </div>
              <div className="rec-player-foot">
                <p>{formatDate(selected.date, { dateStyle: 'medium', timeStyle: 'short' })}<span>·</span>{formatDuration(selected.duration)}{selected.size ? <><span>·</span>{formatSize(selected.size)}</> : null}{selected.roomCode ? <><span>·</span>Room {selected.roomCode}</> : null}</p>
                <div className="dashboard-meeting-actions">
                  <button type="button" className="dashboard-button dashboard-button-secondary" onClick={() => download(selected)} disabled={busy === `download-${selected.id}`}><Download size={16} aria-hidden="true" />Download</button>
                  <button type="button" className="dashboard-button dashboard-button-secondary" onClick={() => share(selected)} disabled={busy === `share-${selected.id}`} title="Anyone with the link can watch for 7 days">
                    {copiedId === selected.id ? <><Check size={16} aria-hidden="true" />Link copied</> : <><Share2 size={16} aria-hidden="true" />Share link</>}
                  </button>
                </div>
              </div>
            </section>
          )}

          {actionError && <p className="dashboard-error rec-action-error" role="alert">{actionError}</p>}

          <section className="dashboard-panel" aria-labelledby="rec-list-title" aria-busy={loading}>
            <div className="dashboard-panel-heading">
              <h2 id="rec-list-title">Your recordings</h2>
              {!loading && visible.length > 0 && <span className="dashboard-count">{visible.length}</span>}
            </div>
            {loadError && recordings.length === 0 ? (
              <div className="dashboard-error">
                <p role="alert">{loadError}</p>
                <button type="button" onClick={fetchRecordings} disabled={loading}><RefreshCw size={16} aria-hidden="true" />Retry</button>
              </div>
            ) : loading && recordings.length === 0 ? (
              <p className="dashboard-empty" role="status">Loading your recordings…</p>
            ) : recordings.length === 0 ? (
              <div className="rec-empty">
                <span className="rec-empty-icon"><Film size={22} aria-hidden="true" /></span>
                <h3>No recordings yet</h3>
                <p>Start recording from the meeting&apos;s More menu. When you stop, the recording is saved here.</p>
                <button type="button" className="dashboard-button dashboard-button-primary" onClick={() => navigate(ROUTES.HOME)}><Video size={16} aria-hidden="true" />Start a meeting</button>
              </div>
            ) : visible.length === 0 ? (
              <p className="dashboard-empty">No recordings match “{query}”.</p>
            ) : (
              <>
                {loadError && <p className="rec-stale" role="alert">{loadError} Showing the last loaded list.</p>}
                <ul className="dashboard-meeting-list rec-list">
                  {visible.map((recording) => (
                    <li key={recording.id} className="dashboard-meeting-row" data-selected={selected?.id === recording.id}>
                      <div className="dashboard-date-tile" aria-hidden="true">
                        <span>{formatDate(recording.date, { month: 'short' })}</span>
                        <strong>{formatDate(recording.date, { day: 'numeric' })}</strong>
                      </div>
                      <div className="dashboard-meeting-info">
                        <h3>{recording.title}</h3>
                        <p>
                          <time dateTime={new Date(recording.date).toISOString()}>{formatDate(recording.date, { hour: 'numeric', minute: '2-digit' })}</time>
                          <span>·</span>{formatDuration(recording.duration)}
                          {recording.size ? <><span>·</span>{formatSize(recording.size)}</> : null}
                          {recording.roomCode ? <><span>·</span>Room {recording.roomCode}</> : null}
                        </p>
                      </div>
                      <div className="dashboard-meeting-actions">
                        <button type="button" className="dashboard-icon-button" onClick={() => download(recording)} disabled={busy === `download-${recording.id}`} title="Download" aria-label={`Download ${recording.title}`}><Download size={16} aria-hidden="true" /></button>
                        <button type="button" className="dashboard-icon-button" onClick={() => share(recording)} disabled={busy === `share-${recording.id}`} title={copiedId === recording.id ? 'Link copied' : 'Copy a 7-day share link'} aria-label={`Share ${recording.title}`}>
                          {copiedId === recording.id ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
                        </button>
                        <button type="button" className="dashboard-join-button" onClick={() => play(recording)} disabled={busy === `play-${recording.id}`}><Play size={15} aria-hidden="true" />Play</button>
                        {confirmDeleteId === recording.id ? (
                          <>
                            <button type="button" className="dashboard-button rec-delete-confirm" onClick={() => remove(recording)} disabled={busy === `delete-${recording.id}`}>{busy === `delete-${recording.id}` ? 'Deleting…' : 'Delete'}</button>
                            <button type="button" className="dashboard-icon-button" onClick={() => setConfirmDeleteId('')} title="Keep recording" aria-label={`Keep ${recording.title}`}><X size={16} aria-hidden="true" /></button>
                          </>
                        ) : (
                          <button type="button" className="dashboard-icon-button rec-delete" onClick={() => setConfirmDeleteId(recording.id)} title="Delete" aria-label={`Delete ${recording.title}`}><Trash2 size={16} aria-hidden="true" /></button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </main>
      </div>
    </AnimatedPage>
  );
}
