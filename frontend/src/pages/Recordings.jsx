import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import AnimatedPage from '../components/layout/AnimatedPage';
import { staggerContainer, staggerChild, hoverLift } from '../utils/animationVariants';
import { Check, Download, Play, Search, Share2, Video, Link2, Clock, Users, RefreshCw } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import transcripts from '../data/transcripts';

import apiClient, { getApiErrorMessage } from '../utils/apiClient';
import { copyMeetingText } from '../utils/meetingClipboard';

const GOLD = 'var(--c-d4af37)';
const GOLD_DIM = 'rgba(212,175,55,0.08)';
const GOLD_BORDER = 'rgba(212,175,55,0.18)';
const CARD = 'color-mix(in srgb, var(--c-0d0e12) 92%, transparent)';
const CARD2 = 'color-mix(in srgb, var(--c-12141a) 85%, transparent)';
const BORDER = 'color-mix(in srgb, var(--c-ffffff) 7%, transparent)';

const API = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');

// Recording durations are stored in seconds.
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, sec = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

export default function Recordings() {
  const [query, setQuery] = useState('');
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [copied, setCopied] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [playUrl, setPlayUrl] = useState('');
  const [linkError, setLinkError] = useState('');

  useEffect(() => { setPlayUrl(''); setLinkError(''); }, [selectedRecording?.id]);

  // Signed, expiring link from the backend: <video> and downloads cannot send the Authorization header.
  const recordingLink = async (share = false) => {
    const res = await apiClient.post(`/api/recordings/${selectedRecording.id}/link`, { share });
    return `${API.replace(/\/$/, '')}${res.data.url}`;
  };
  const fetchRecordings = useCallback(async () => {
    setRecLoading(true);
    setLoadError('');
    try {
      const res = await apiClient.get('/api/recordings');
      const raw = res.data?.data?.recordings ?? [];
      setRecordings(raw.map((r) => ({
        id: r._id,
        title: r.originalName?.replace(/\.[^.]+$/, '') || r.roomCode,
        duration: r.duration || 0,
        participants: [],
        date: r.createdAt,
        meetingId: r.roomCode,
        videoUrl: `/api/recordings/${r._id}`,
        transcriptPreview: '',
      })));
    } catch (error) {
      // Keep whatever was shown before; say the load failed instead of looking like an empty library.
      setLoadError(getApiErrorMessage(error, 'Could not load your recordings.'));
    } finally {
      setRecLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecordings(); }, [fetchRecordings]);

  const handlePlay = async () => {
    if (!selectedRecording?.videoUrl) return;
    try { setLinkError(''); setPlayUrl(await recordingLink()); }
    catch (error) { setLinkError(getApiErrorMessage(error, 'Could not open this recording.')); }
  };

  const handleDownload = async () => {
    if (!selectedRecording?.videoUrl) return;
    try {
      setLinkError('');
      const a = document.createElement('a');
      a.href = `${await recordingLink()}&download=1`;
      a.download = `${selectedRecording.title}.webm`;
      a.click();
    } catch (error) { setLinkError(getApiErrorMessage(error, 'Could not download this recording.')); }
  };

  // Copies a link to the recording itself that anyone can play for 7 days (deleting the recording revokes it).
  const handleShare = async () => {
    if (!selectedRecording?.videoUrl) return;
    try {
      setLinkError('');
      await copyMeetingText(await recordingLink(true));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) { setLinkError(getApiErrorMessage(error, 'Could not create a share link.')); }
  };



  const filteredRecordings = useMemo(
    () => recordings.filter((r) => r.title.toLowerCase().includes(query.toLowerCase())),
    [query, recordings],
  );

  const transcript = transcripts.find((e) => e.meetingId === selectedRecording?.meetingId);

  return (
    <AnimatedPage>
      <div style={{ minHeight: '100dvh', background: 'var(--c-000000)', color: 'var(--t-ffffff)', position: 'relative' }}>
        <TopBar />

        <main style={{ maxWidth: 1450, margin: '0 auto', padding: '16px 14px 60px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Hero ── */}
          <div style={{
            borderRadius: 24,
            border: `1px solid ${BORDER}`,
            background: 'linear-gradient(135deg,color-mix(in srgb, var(--c-131520) 97%, transparent),color-mix(in srgb, var(--c-0a0b10) 92%, transparent))',
            padding: '20px 18px',
            boxShadow: '0 24px 80px color-mix(in srgb, var(--s-000000) 60%, transparent), inset 0 1px 0 color-mix(in srgb, var(--c-ffffff) 6%, transparent)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'color-mix(in srgb, var(--t-d4b571) 45%, transparent)', margin: 0 }}>
                  Smart Recording Studio
                </p>
                <h1 style={{ margin: '8px 0 0', fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--t-ffffff)', fontFamily: 'Syne, sans-serif' }}>
                  Search the room after the room
                </h1>
                <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.7, color: 'color-mix(in srgb, var(--t-ffffff) 70%, transparent)', maxWidth: 480 }}>
                  Browse chaptered recordings, jump through transcript moments, and share structured playback.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                <div style={{
                  borderRadius: 16, border: `1px solid ${BORDER}`,
                  background: 'color-mix(in srgb, var(--c-ffffff) 4%, transparent)',
                  padding: '14px 20px', textAlign: 'center', minWidth: 90,
                }}>
                  <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--t-ffffff)' }}>{recordings.length}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'color-mix(in srgb, var(--t-ffffff) 65%, transparent)' }}>Recordings</p>
                </div>
              </div>
            </div>

            {/* Search */}
            <div style={{ marginTop: 20, position: 'relative' }}>
              <Search style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                width: 15, height: 15, color: 'color-mix(in srgb, var(--t-ffffff) 25%, transparent)', pointerEvents: 'none',
              }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recordings by name…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'color-mix(in srgb, var(--c-ffffff) 5%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--c-ffffff) 9%, transparent)',
                  borderRadius: 14,
                  padding: '11px 16px 11px 40px',
                  fontSize: 13, color: 'var(--t-ffffff)',
                  outline: 'none',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              />
            </div>
          </div>

          {/* ── Two-column layout ── */}
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">

            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>



              {/* Saved recordings list */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'color-mix(in srgb, var(--t-ffffff) 75%, transparent)' }}>
                    Saved recordings
                  </p>
                  <button
                    onClick={fetchRecordings}
                    title="Refresh"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                      color: 'color-mix(in srgb, var(--t-ffffff) 60%, transparent)', display: 'flex', alignItems: 'center',
                    }}
                  >
                    <RefreshCw style={{ width: 13, height: 13, animation: recLoading ? 'spin 0.8s linear infinite' : 'none' }} />
                  </button>
                </div>
                {loadError && filteredRecordings.length > 0 && (
                  <p role="alert" style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--t-f87171)' }}>
                    {loadError} Showing the last loaded list. <button type="button" onClick={fetchRecordings} style={{ background: 'none', border: 'none', color: 'var(--t-d4af37)', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Try again</button>
                  </p>
                )}
                {filteredRecordings.length === 0 ? (
                  <div style={{
                    borderRadius: 22, border: '1px dashed color-mix(in srgb, var(--c-ffffff) 10%, transparent)',
                    padding: '40px 24px', textAlign: 'center',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: 'color-mix(in srgb, var(--c-ffffff) 4%, transparent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Video style={{ width: 22, height: 22, color: 'color-mix(in srgb, var(--t-ffffff) 20%, transparent)' }} />
                    </div>
                    {loadError ? (
                      <>
                        <p role="alert" style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--t-f87171)' }}>{loadError}</p>
                        <button type="button" onClick={fetchRecordings} style={{ background: 'none', border: `1px solid ${GOLD_BORDER}`, borderRadius: 10, padding: '6px 14px', color: 'var(--t-d4af37)', fontSize: 12, cursor: 'pointer' }}>Try again</button>
                      </>
                    ) : (
                      <>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'color-mix(in srgb, var(--t-ffffff) 65%, transparent)' }}>{recLoading ? 'Loading…' : 'No recordings yet'}</p>
                        {!recLoading && <p style={{ margin: 0, fontSize: 11, color: 'color-mix(in srgb, var(--t-ffffff) 55%, transparent)', lineHeight: 1.6, maxWidth: 220 }}>Join a meeting → click Record → stop to save here</p>}
                      </>
                    )}
                  </div>
                ) : (
                  <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                    {filteredRecordings.map((recording) => {
                      const selected = selectedRecording?.id === recording.id;
                      return (
                        <motion.button
                          key={recording.id}
                          variants={staggerChild}
                          {...hoverLift}
                          onClick={() => setSelectedRecording(recording)}
                          style={{
                            display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14,
                            borderRadius: 20, padding: 14, textAlign: 'left', width: '100%',
                            background: selected ? GOLD_DIM : 'color-mix(in srgb, var(--c-ffffff) 3%, transparent)',
                            border: selected ? `1px solid ${GOLD_BORDER}` : `1px solid ${BORDER}`,
                            cursor: 'pointer', boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--c-ffffff) 4%, transparent)',
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{
                            width: 96, height: 72, borderRadius: 14, flexShrink: 0,
                            background: `linear-gradient(135deg,rgba(212,181,113,0.25),rgba(111,81,21,0.45))`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Play style={{ width: 20, height: 20, color: 'var(--t-ffffff)' }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--t-ffffff)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {recording.title}
                            </p>
                            <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'color-mix(in srgb, var(--t-ffffff) 38%, transparent)' }}>
                                <Clock style={{ width: 11, height: 11 }} />{formatDuration(recording.duration)}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'color-mix(in srgb, var(--t-ffffff) 38%, transparent)' }}>
                                <Users style={{ width: 11, height: 11 }} />{recording.participants.length}
                              </span>
                              <span style={{ fontSize: 11, color: 'color-mix(in srgb, var(--t-ffffff) 58%, transparent)' }}>
                                {new Date(recording.date).toLocaleDateString()}
                              </span>
                            </div>
                            <p style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.5, color: 'color-mix(in srgb, var(--t-ffffff) 65%, transparent)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {recording.transcriptPreview}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Right column — player / empty */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!selectedRecording ? (
                <div style={{
                  borderRadius: 28, border: '1px dashed color-mix(in srgb, var(--c-ffffff) 8%, transparent)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 14, padding: 60, textAlign: 'center', minHeight: 360,
                }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Play style={{ width: 24, height: 24, color: 'var(--t-d4af37)', opacity: 0.5 }} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'color-mix(in srgb, var(--t-ffffff) 65%, transparent)' }}>No recording selected</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'color-mix(in srgb, var(--t-ffffff) 20%, transparent)' }}>Pick one from the list to preview it</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Video player */}
                  <div style={{
                    borderRadius: 28, border: `1px solid ${BORDER}`,
                    background: CARD, padding: 22,
                    boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--c-ffffff) 4%, transparent)',
                  }}>
                    <p style={{ margin: '0 0 14px', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'color-mix(in srgb, var(--t-ffffff) 75%, transparent)' }}>
                      {selectedRecording.title}
                    </p>
                    <div style={{
                      aspectRatio: '16/9', borderRadius: 18, border: `1px solid ${BORDER}`,
                      background: 'linear-gradient(135deg,rgba(212,175,55,0.06),color-mix(in srgb, var(--c-0a0b10) 98%, transparent))',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                      overflow: 'hidden',
                    }}>
                      {playUrl ? (
                        <video src={playUrl} controls autoPlay style={{ width: '100%', height: '100%', background: 'var(--c-000000)' }} />
                      ) : selectedRecording.videoUrl ? (
                        <button
                          onClick={handlePlay}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            background: `linear-gradient(135deg,${GOLD},var(--c-b8860b))`,
                            border: 'none', borderRadius: 14, padding: '12px 24px',
                            fontSize: 14, fontWeight: 700, color: 'var(--t-000000)', cursor: 'pointer',
                          }}
                        >
                          <Play style={{ width: 18, height: 18 }} /> Play recording
                        </button>
                      ) : (
                        <>
                          <Play style={{ width: 36, height: 36, opacity: 0.12, color: 'var(--t-ffffff)' }} />
                          <p style={{ margin: 0, fontSize: 12, color: 'color-mix(in srgb, var(--t-ffffff) 55%, transparent)', textAlign: 'center', maxWidth: 200, lineHeight: 1.5 }}>
                            Video unavailable — no egress output was saved
                          </p>
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                      <button
                        onClick={handleDownload}
                        disabled={!selectedRecording.videoUrl}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          border: `1px solid ${BORDER}`, background: 'color-mix(in srgb, var(--c-ffffff) 5%, transparent)',
                          borderRadius: 12, padding: '9px 16px', fontSize: 13,
                          color: 'color-mix(in srgb, var(--t-ffffff) 60%, transparent)', cursor: 'pointer',
                          opacity: selectedRecording.videoUrl ? 1 : 0.35,
                          fontFamily: 'DM Sans, sans-serif',
                        }}
                      >
                        <Download style={{ width: 15, height: 15 }} /> Download
                      </button>
                      <button
                        onClick={handleShare}
                        disabled={!selectedRecording.videoUrl}
                        title="Anyone with the link can watch for 7 days"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          border: `1px solid ${BORDER}`, background: 'color-mix(in srgb, var(--c-ffffff) 5%, transparent)',
                          borderRadius: 12, padding: '9px 16px', fontSize: 13,
                          color: copied ? 'var(--t-4ade80)' : 'color-mix(in srgb, var(--t-ffffff) 60%, transparent)', cursor: 'pointer',
                          fontFamily: 'DM Sans, sans-serif', transition: 'color 0.2s',
                        }}
                      >
                        {copied ? <Check style={{ width: 15, height: 15 }} /> : <Share2 style={{ width: 15, height: 15 }} />}
                        {copied ? 'Copied! Valid for 7 days' : 'Share link'}
                      </button>
                    </div>
                    {linkError && <p role="alert" style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--t-f87171)' }}>{linkError}</p>}
                  </div>

                  {/* Chapters + Transcript */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ borderRadius: 20, border: `1px solid ${BORDER}`, background: CARD2, padding: 18 }}>
                      <p style={{ margin: '0 0 12px', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'color-mix(in srgb, var(--t-ffffff) 75%, transparent)' }}>Chapters</p>
                      {selectedRecording.chapters?.length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {selectedRecording.chapters.map((ch) => (
                            <div key={ch.title} style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              borderRadius: 12, border: '1px solid color-mix(in srgb, var(--c-ffffff) 6%, transparent)',
                              background: 'color-mix(in srgb, var(--c-000000) 15%, transparent)', padding: '9px 12px',
                            }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-d4af37)', fontVariantNumeric: 'tabular-nums' }}>
                                {Math.floor(ch.time / 60)}m
                              </span>
                              <p style={{ margin: 0, fontSize: 12, color: 'color-mix(in srgb, var(--t-ffffff) 75%, transparent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ch.title}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, color: 'color-mix(in srgb, var(--t-ffffff) 55%, transparent)', textAlign: 'center', padding: '16px 0' }}>No chapters</p>
                      )}
                    </div>

                    <div style={{ borderRadius: 20, border: `1px solid ${BORDER}`, background: CARD2, padding: 18 }}>
                      <p style={{ margin: '0 0 12px', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'color-mix(in srgb, var(--t-ffffff) 75%, transparent)' }}>Transcript</p>
                      {(transcript?.entries || []).length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                          {(transcript?.entries || []).slice(0, 8).map((entry) => (
                            <div key={`${entry.timestamp}-${entry.speaker}`} style={{
                              borderRadius: 12, border: '1px solid color-mix(in srgb, var(--c-ffffff) 6%, transparent)',
                              background: 'color-mix(in srgb, var(--c-000000) 15%, transparent)', padding: '9px 12px',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'color-mix(in srgb, var(--t-ffffff) 75%, transparent)' }}>{entry.speaker}</p>
                                <span style={{ fontSize: 10, color: 'color-mix(in srgb, var(--t-ffffff) 58%, transparent)', flexShrink: 0 }}>{entry.timestamp}</span>
                              </div>
                              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: 'color-mix(in srgb, var(--t-ffffff) 70%, transparent)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                {entry.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, color: 'color-mix(in srgb, var(--t-ffffff) 55%, transparent)', textAlign: 'center', padding: '16px 0' }}>No transcript</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </AnimatedPage>
  );
}
