import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CalendarClock, Download, X } from 'lucide-react';
import { getApiErrorMessage } from '../../../utils/apiClient';
import { useDialogFocus } from '../../../hooks/useDialogFocus';

import './scheduler.css';

const recurringOptions = ['none', 'daily', 'weekly'];

function toIcsDate(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// RFC 5545 text values: escape backslash, comma, semicolon and newlines.
const icsText = (value) => String(value).replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');

/** Calendar invite pointing at the meeting's registered room. */
function downloadInvite(meeting) {
  const start = new Date(meeting.date);
  const end = new Date(start.getTime() + meeting.duration * 60000);
  const url = `${window.location.origin}/room/${meeting.roomCode}`;
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EtherXMeet//EN',
    'BEGIN:VEVENT',
    `UID:${meeting.id}@etherxmeet.app`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(start)}`, `DTEND:${toIcsDate(end)}`,
    ...(meeting.recurring !== 'none' ? [`RRULE:FREQ=${meeting.recurring.toUpperCase()}`] : []),
    `SUMMARY:${icsText(meeting.title)}`,
    `DESCRIPTION:${icsText(`Join the EtherXMeet room: ${url}`)}`,
    `LOCATION:${icsText(url)}`,
    `URL:${url}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' });
  const slug = meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meeting';
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${slug}.ics` });
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Scheduler({ isOpen, onClose, onSchedule }) {
  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const reduceMotion = useReducedMotion();
  useDialogFocus(dialogRef, onClose, isOpen);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    time: '10:00',
    duration: '45',
    recurring: 'none',
    participants: '',
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    formRef.current?.querySelector('input')?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isOpen]);

  const set = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));
  const save = async (withInvite) => {
    if (saving || !form.title.trim() || !formRef.current?.reportValidity()) return;
    setSaving(true);
    setError('');
    try {
      const meeting = await onSchedule({
        title: form.title.trim(),
        startAt: new Date(`${form.date}T${form.time}`).toISOString(),
        duration: Number(form.duration),
        participants: form.participants.split(',').map((email) => email.trim()).filter(Boolean),
        recurring: form.recurring,
      });
      if (withInvite) downloadInvite(meeting);
      setForm((previous) => ({ ...previous, title: '', participants: '' }));
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save this meeting.'));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="scheduler-overlay"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.15 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="scheduler-title"
            className="scheduler-dialog"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="scheduler-header">
              <h2 id="scheduler-title">Schedule a meeting</h2>
              <button type="button" className="scheduler-close" aria-label="Close scheduler" onClick={onClose}>
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <form ref={formRef} className="scheduler-form" onSubmit={(event) => { event.preventDefault(); save(false); }}>
              <div className="scheduler-field">
                <label htmlFor="scheduler-meeting-title">Meeting title <span aria-hidden="true">*</span></label>
                <input id="scheduler-meeting-title" required value={form.title} onChange={set('title')} placeholder="Meeting name" />
              </div>

              <div className="scheduler-fields">
                <div className="scheduler-field">
                  <label htmlFor="scheduler-date">Date</label>
                  <input id="scheduler-date" type="date" required value={form.date} onChange={set('date')} />
                </div>
                <div className="scheduler-field">
                  <label htmlFor="scheduler-time">Time</label>
                  <input id="scheduler-time" type="time" required value={form.time} onChange={set('time')} />
                </div>
              </div>

              <div className="scheduler-fields">
                <div className="scheduler-field">
                  <label htmlFor="scheduler-duration">Duration (minutes)</label>
                  <input id="scheduler-duration" type="number" required min="5" max="480" value={form.duration} onChange={set('duration')} />
                </div>
                <fieldset className="scheduler-field scheduler-recurrence">
                  <legend>Repeat</legend>
                  <div className="scheduler-segments">
                    {recurringOptions.map((option) => (
                      <button type="button" key={option} aria-pressed={form.recurring === option} onClick={() => setForm((previous) => ({ ...previous, recurring: option }))}>
                        {option === 'none' ? 'None' : option === 'daily' ? 'Daily' : 'Weekly'}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>

              <div className="scheduler-field">
                <label htmlFor="scheduler-participants">Participants <span className="scheduler-optional">(optional)</span></label>
                <input id="scheduler-participants" value={form.participants} onChange={set('participants')} placeholder="Email addresses" aria-describedby="scheduler-participant-help" />
                <p className="scheduler-help" id="scheduler-participant-help">Separate email addresses with commas.</p>
              </div>

              {error && <p role="alert" className="scheduler-error">{error}</p>}

              <footer className="scheduler-actions">
                <button type="submit" className="scheduler-save" disabled={!form.title.trim() || saving}>
                  <CalendarClock size={17} aria-hidden="true" />{saving ? 'Saving…' : 'Save schedule'}
                </button>
                <button type="button" className="scheduler-invite" disabled={!form.title.trim() || saving} onClick={() => save(true)} title="Save and download a calendar invite">
                  <Download size={17} aria-hidden="true" />Save + invite
                </button>
              </footer>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
