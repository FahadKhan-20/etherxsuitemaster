import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarClock, Download, Repeat, Users, X } from 'lucide-react';
import { useMeeting } from '../../../context/MeetingContext';

const GOLD = '#d4af37';
const GOLD_DIM = 'rgba(212,175,55,0.1)';
const GOLD_BORDER = 'rgba(212,175,55,0.25)';
const BORDER = 'rgba(255,255,255,0.08)';
const INPUT_STYLE = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 10, padding: '10px 14px',
  fontSize: 14, color: '#fff',
  outline: 'none', fontFamily: 'DM Sans, sans-serif',
};
const LABEL_STYLE = { display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 6, letterSpacing: '0.03em', fontWeight: 500 };

const recurringOptions = ['none', 'daily', 'weekly'];

function toIcsDate(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export default function Scheduler({ isOpen, onClose }) {
  const { scheduleMeeting } = useMeeting();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    title: '',
    date: tomorrow,
    time: '10:00',
    duration: '45',
    recurring: 'none',
    participants: '',
  });

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const preview = useMemo(() => {
    const start = new Date(`${form.date}T${form.time}`);
    const end = new Date(start.getTime() + Number(form.duration) * 60000);
    return { start, end };
  }, [form.date, form.time, form.duration]);

  const downloadIcs = () => {
    const start = toIcsDate(preview.start);
    const end = toIcsDate(preview.end);
    const slug = form.title.toLowerCase().replace(/\s+/g, '-') || 'meeting';
    const body = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EtherXMeet//EN',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@etherxmeet.app`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${start}`, `DTEND:${end}`,
      `SUMMARY:${form.title || 'EtherXMeet session'}`,
      `DESCRIPTION:EtherXMeet scheduled session`,
      `LOCATION:${window.location.origin}/room/${slug}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${slug}.ics` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission().catch(() => {});
    }
    scheduleMeeting({
      title: form.title,
      date: preview.start.toISOString(),
      duration: Number(form.duration),
      participants: form.participants.split(',').map((p) => p.trim()).filter(Boolean),
      recurring: form.recurring,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
            padding: 16,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 860,
              borderRadius: 28,
              border: `1px solid ${BORDER}`,
              background: 'rgba(11,12,18,0.97)',
              padding: 28,
              boxShadow: '0 30px 90px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
              backdropFilter: 'blur(24px)',
              maxHeight: '90vh', overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
              <div>
                <p style={{ margin: 0, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.5)' }}>
                  Integrated Scheduler
                </p>
                <h2 style={{ margin: '6px 0 6px', fontSize: 26, fontWeight: 700, color: '#fff', fontFamily: 'Syne, sans-serif', letterSpacing: '-0.03em' }}>
                  Book a future room
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }}>
                  Schedule a session, download a calendar invite, and get browser reminders.
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: `1px solid ${BORDER}`,
                  borderRadius: 10, width: 36, height: 36, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.6)', flexShrink: 0,
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Body */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

              {/* Left — form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={LABEL_STYLE}>Meeting title *</label>
                  <input value={form.title} onChange={set('title')} placeholder="e.g. Weekly Strategy Sync" style={INPUT_STYLE} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={LABEL_STYLE}>Date</label>
                    <input type="date" value={form.date} onChange={set('date')} style={INPUT_STYLE} />
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Time</label>
                    <input type="time" value={form.time} onChange={set('time')} style={INPUT_STYLE} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={LABEL_STYLE}>Duration (minutes)</label>
                    <input type="number" min="5" max="480" value={form.duration} onChange={set('duration')} style={INPUT_STYLE} />
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Recurring</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {recurringOptions.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setForm((p) => ({ ...p, recurring: opt }))}
                          style={{
                            flex: 1, padding: '9px 4px', borderRadius: 8, fontSize: 11,
                            fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                            fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
                            background: form.recurring === opt ? GOLD_DIM : 'rgba(255,255,255,0.04)',
                            border: form.recurring === opt ? `1px solid ${GOLD_BORDER}` : `1px solid ${BORDER}`,
                            color: form.recurring === opt ? GOLD : 'rgba(255,255,255,0.45)',
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={LABEL_STYLE}>Participants (comma-separated emails)</label>
                  <input value={form.participants} onChange={set('participants')} placeholder="alice@email.com, bob@email.com" style={INPUT_STYLE} />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button
                    onClick={handleSubmit}
                    disabled={!form.title.trim()}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      background: form.title.trim() ? `linear-gradient(135deg,${GOLD},#b8860b)` : 'rgba(255,255,255,0.06)',
                      border: 'none', borderRadius: 12, padding: '12px 20px',
                      fontSize: 13, fontWeight: 700,
                      color: form.title.trim() ? '#000' : 'rgba(255,255,255,0.3)',
                      cursor: form.title.trim() ? 'pointer' : 'not-allowed',
                      fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s',
                    }}
                  >
                    <CalendarClock style={{ width: 15, height: 15 }} />
                    Save schedule
                  </button>
                  <button
                    onClick={downloadIcs}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`,
                      borderRadius: 12, padding: '12px 16px', fontSize: 13, fontWeight: 600,
                      color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                      fontFamily: 'DM Sans, sans-serif',
                    }}
                  >
                    <Download style={{ width: 14, height: 14 }} />
                    .ics
                  </button>
                </div>
              </div>

              {/* Right — preview */}
              <div style={{
                borderRadius: 20, border: `1px solid ${BORDER}`,
                background: 'rgba(255,255,255,0.03)', padding: 20,
              }}>
                <p style={{ margin: '0 0 4px', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Preview</p>
                <h3 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>
                  {form.title || <span style={{ color: 'rgba(255,255,255,0.2)' }}>Untitled meeting</span>}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ borderRadius: 14, border: `1px solid ${BORDER}`, background: 'rgba(0,0,0,0.15)', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
                      <CalendarClock style={{ width: 16, height: 16, color: GOLD }} />
                      <span>
                        {preview.start.toLocaleDateString()} at{' '}
                        {preview.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 8 }}>
                      <Repeat style={{ width: 14, height: 14 }} />
                      <span style={{ textTransform: 'capitalize' }}>{form.recurring === 'none' ? 'One-time' : `Repeats ${form.recurring}`}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.72)', fontSize: 12, marginTop: 8 }}>
                      <Users style={{ width: 14, height: 14 }} />
                      <span>
                        {form.participants.split(',').filter((p) => p.trim()).length} participant{form.participants.split(',').filter((p) => p.trim()).length !== 1 ? 's' : ''} invited
                      </span>
                    </div>
                  </div>

                  <div style={{
                    borderRadius: 14, border: '1px solid rgba(212,175,55,0.15)',
                    background: 'rgba(212,175,55,0.05)', padding: '12px 16px',
                    fontSize: 12, lineHeight: 1.7, color: 'rgba(255,255,255,0.75)',
                  }}>
                    Lobby opens 5 min before start. Browser reminders fire 15 min before kickoff when notifications are allowed.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
