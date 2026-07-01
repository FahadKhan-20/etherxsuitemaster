import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import AnimatedPage from '../components/layout/AnimatedPage';
import { staggerContainer, staggerChild, hoverLift } from '../utils/animationVariants';
import { Check, Download, Play, Search, Share2, Video, Link2, Clock, Users, RefreshCw } from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import transcripts from '../data/transcripts';

import apiClient from '../utils/apiClient';

const GOLD = '#d4af37';
const GOLD_DIM = 'rgba(212,175,55,0.08)';
const GOLD_BORDER = 'rgba(212,175,55,0.18)';
const CARD = 'rgba(13,14,18,0.92)';
const CARD2 = 'rgba(18,20,26,0.85)';
const BORDER = 'rgba(255,255,255,0.07)';

const API = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');

export default function Recordings() {
  const [query, setQuery] = useState('');
  const [selectedRecording, setSelectedRecording] = useState(null);
  const [copied, setCopied] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [recLoading, setRecLoading] = useState(false);

  const fetchRecordings = useCallback(async () => {
    setRecLoading(true);
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
        videoUrl: `${API}/api/recordings/${r._id}`,
        transcriptPreview: '',
      })));
    } catch {
      setRecordings([]);
    } finally {
      setRecLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecordings(); }, [fetchRecordings]);

  const handlePlay = () => {
    if (selectedRecording?.videoUrl) window.open(selectedRecording.videoUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = () => {
    if (!selectedRecording?.videoUrl) return;
    const a = document.createElement('a');
    a.href = selectedRecording.videoUrl;
    a.download = `${selectedRecording.title}.webm`;
    a.click();
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/room/${selectedRecording?.meetingId}`;
    try { await navigator.clipboard.writeText(url); } catch { prompt('Copy this link:', url); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };



  const filteredRecordings = useMemo(
    () => recordings.filter((r) => r.title.toLowerCase().includes(query.toLowerCase())),
    [query, recordings],
  );

  const transcript = transcripts.find((e) => e.meetingId === selectedRecording?.meetingId);

  return (
    <AnimatedPage>
      <div style={{ minHeight: '100dvh', background: '#141414', color: '#fff', position: 'relative' }}>
        <div className="aurora-bg aurora-subtle" aria-hidden="true" />
        <TopBar />

        <main style={{ maxWidth: 1450, margin: '0 auto', padding: '24px 24px 60px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── Hero ── */}
          <div style={{
            borderRadius: 28,
            border: `1px solid ${BORDER}`,
            background: 'linear-gradient(135deg,rgba(19,21,32,0.97),rgba(10,11,16,0.92))',
            padding: '28px 32px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(212,181,113,0.45)', margin: 0 }}>
                  Smart Recording Studio
                </p>
                <h1 style={{ margin: '8px 0 0', fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em', color: '#fff', fontFamily: 'Syne, sans-serif' }}>
                  Search the room after the room
                </h1>
                <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.7)', maxWidth: 480 }}>
                  Browse chaptered recordings, jump through transcript moments, and share structured playback.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                <div style={{
                  borderRadius: 16, border: `1px solid ${BORDER}`,
                  background: 'rgba(255,255,255,0.04)',
                  padding: '14px 20px', textAlign: 'center', minWidth: 90,
                }}>
                  <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#fff' }}>{recordings.length}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>Recordings</p>
                </div>
              </div>
            </div>

            {/* Search */}
            <div style={{ marginTop: 20, position: 'relative' }}>
              <Search style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                width: 15, height: 15, color: 'rgba(255,255,255,0.25)', pointerEvents: 'none',
              }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recordings by name…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 14,
                  padding: '11px 16px 11px 40px',
                  fontSize: 13, color: '#fff',
                  outline: 'none',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              />
            </div>
          </div>

          {/* ── Two-column layout ── */}
          <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)' }}>

            {/* Left column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>



              {/* Saved recordings list */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' }}>
                    Saved recordings
                  </p>
                  <button
                    onClick={fetchRecordings}
                    title="Refresh"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                      color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center',
                    }}
                  >
                    <RefreshCw style={{ width: 13, height: 13, animation: recLoading ? 'spin 0.8s linear infinite' : 'none' }} />
                  </button>
                </div>
                {filteredRecordings.length === 0 ? (
                  <div style={{
                    borderRadius: 22, border: '1px dashed rgba(255,255,255,0.1)',
                    padding: '40px 24px', textAlign: 'center',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.04)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Video style={{ width: 22, height: 22, color: 'rgba(255,255,255,0.2)' }} />
                    </div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.65)' }}>No recordings yet</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, maxWidth: 220 }}>
                      {recLoading ? 'Loading…' : 'Join a meeting → click Record → stop to save here'}
                    </p>
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
                            background: selected ? GOLD_DIM : 'rgba(255,255,255,0.03)',
                            border: selected ? `1px solid ${GOLD_BORDER}` : `1px solid ${BORDER}`,
                            cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{
                            width: 96, height: 72, borderRadius: 14, flexShrink: 0,
                            background: `linear-gradient(135deg,rgba(212,181,113,0.25),rgba(111,81,21,0.45))`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Play style={{ width: 20, height: 20, color: '#fff' }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {recording.title}
                            </p>
                            <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>
                                <Clock style={{ width: 11, height: 11 }} />{recording.duration}m
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>
                                <Users style={{ width: 11, height: 11 }} />{recording.participants.length}
                              </span>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.58)' }}>
                                {new Date(recording.date).toLocaleDateString()}
                              </span>
                            </div>
                            <p style={{ margin: '6px 0 0', fontSize: 11, lineHeight: 1.5, color: 'rgba(255,255,255,0.65)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
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
                  borderRadius: 28, border: '1px dashed rgba(255,255,255,0.08)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 14, padding: 60, textAlign: 'center', minHeight: 360,
                }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%',
                    background: GOLD_DIM, border: `1px solid ${GOLD_BORDER}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Play style={{ width: 24, height: 24, color: GOLD, opacity: 0.5 }} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>No recording selected</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>Pick one from the list to preview it</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Video player */}
                  <div style={{
                    borderRadius: 28, border: `1px solid ${BORDER}`,
                    background: CARD, padding: 22,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                  }}>
                    <p style={{ margin: '0 0 14px', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' }}>
                      {selectedRecording.title}
                    </p>
                    <div style={{
                      aspectRatio: '16/9', borderRadius: 18, border: `1px solid ${BORDER}`,
                      background: 'linear-gradient(135deg,rgba(212,175,55,0.06),rgba(10,11,16,0.98))',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                      overflow: 'hidden',
                    }}>
                      {selectedRecording.videoUrl ? (
                        <button
                          onClick={handlePlay}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            background: `linear-gradient(135deg,${GOLD},#b8860b)`,
                            border: 'none', borderRadius: 14, padding: '12px 24px',
                            fontSize: 14, fontWeight: 700, color: '#000', cursor: 'pointer',
                          }}
                        >
                          <Play style={{ width: 18, height: 18 }} /> Play recording
                        </button>
                      ) : (
                        <>
                          <Play style={{ width: 36, height: 36, opacity: 0.12, color: '#fff' }} />
                          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center', maxWidth: 200, lineHeight: 1.5 }}>
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
                          border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)',
                          borderRadius: 12, padding: '9px 16px', fontSize: 13,
                          color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                          opacity: selectedRecording.videoUrl ? 1 : 0.35,
                          fontFamily: 'DM Sans, sans-serif',
                        }}
                      >
                        <Download style={{ width: 15, height: 15 }} /> Download
                      </button>
                      <button
                        onClick={handleShare}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          border: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.05)',
                          borderRadius: 12, padding: '9px 16px', fontSize: 13,
                          color: copied ? '#4ade80' : 'rgba(255,255,255,0.6)', cursor: 'pointer',
                          fontFamily: 'DM Sans, sans-serif', transition: 'color 0.2s',
                        }}
                      >
                        {copied ? <Check style={{ width: 15, height: 15 }} /> : <Share2 style={{ width: 15, height: 15 }} />}
                        {copied ? 'Copied!' : 'Share link'}
                      </button>
                    </div>
                  </div>

                  {/* Chapters + Transcript */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ borderRadius: 20, border: `1px solid ${BORDER}`, background: CARD2, padding: 18 }}>
                      <p style={{ margin: '0 0 12px', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' }}>Chapters</p>
                      {selectedRecording.chapters?.length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {selectedRecording.chapters.map((ch) => (
                            <div key={ch.title} style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
                              background: 'rgba(0,0,0,0.15)', padding: '9px 12px',
                            }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>
                                {Math.floor(ch.time / 60)}m
                              </span>
                              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ch.title}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', padding: '16px 0' }}>No chapters</p>
                      )}
                    </div>

                    <div style={{ borderRadius: 20, border: `1px solid ${BORDER}`, background: CARD2, padding: 18 }}>
                      <p style={{ margin: '0 0 12px', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)' }}>Transcript</p>
                      {(transcript?.entries || []).length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                          {(transcript?.entries || []).slice(0, 8).map((entry) => (
                            <div key={`${entry.timestamp}-${entry.speaker}`} style={{
                              borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
                              background: 'rgba(0,0,0,0.15)', padding: '9px 12px',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{entry.speaker}</p>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.58)', flexShrink: 0 }}>{entry.timestamp}</span>
                              </div>
                              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.5, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                {entry.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', padding: '16px 0' }}>No transcript</p>
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
