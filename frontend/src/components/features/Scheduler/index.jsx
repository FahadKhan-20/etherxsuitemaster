import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CalendarClock, CalendarPlus, Download, X } from 'lucide-react';
import { googleCalendarUrl } from '../../../utils/googleCalendar';
import { getApiErrorMessage } from '../../../utils/apiClient';
import { useDialogFocus } from '../../../hooks/useDialogFocus';
import { useUser } from '../../../context/UserContext';
import { dateInTimezone, scheduleTimezone, tomorrowInTimezone, validateSchedule } from '../../../utils/scheduleValidation';

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
  const { user } = useUser();
  const timezone = scheduleTimezone(user.timezone);
  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const reduceMotion = useReducedMotion();
  useDialogFocus(dialogRef, onClose, isOpen);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    title: '',
    date: tomorrowInTimezone(timezone),
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

  const set = (key) => (event) => {
    setForm((previous) => ({ ...previous, [key]: event.target.value }));
    setFieldErrors((previous) => ({ ...previous, [key]: undefined, ...(['date', 'time'].includes(key) ? { date: undefined, time: undefined } : {}) }));
    setError('');
  };
  const fieldError = (key) => fieldErrors[key] && <p className="scheduler-field-error" id={`scheduler-${key}-error`} role="alert">{fieldErrors[key]}</p>;
  const fieldA11y = (key) => ({ 'aria-invalid': !!fieldErrors[key], 'aria-describedby': fieldErrors[key] ? `scheduler-${key}-error` : undefined });
  // withInvite: 'ics' downloads an invite file, 'google' opens Google Calendar with the meeting filled in.
  const save = async (withInvite) => {
    if (saving) return;
    const result = validateSchedule(form, timezone);
    setFieldErrors(result.errors);
    if (!result.input) {
      const invalid = Object.keys(result.errors)[0];
      document.getElementById(invalid === 'title' ? 'scheduler-meeting-title' : `scheduler-${invalid}`)?.focus();
      return;
    }
    setSaving(true);
    setError('');
    // Open the tab during the click; browsers block pop-ups opened after waiting for the server.
    const calendarTab = withInvite === 'google' ? window.open('', '_blank') : null;
    try {
      const meeting = await onSchedule(result.input);
      if (withInvite === 'ics') downloadInvite(meeting);
      if (calendarTab) { calendarTab.opener = null; calendarTab.location.href = googleCalendarUrl(meeting); }
      setForm((previous) => ({ ...previous, title: '', participants: '' }));
      onClose();
    } catch (err) {
      calendarTab?.close();
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

            <form ref={formRef} noValidate className="scheduler-form" onSubmit={(event) => { event.preventDefault(); save(false); }}>
              <div className="scheduler-field">
                <label htmlFor="scheduler-meeting-title">Meeting title <span aria-hidden="true">*</span></label>
                <input id="scheduler-meeting-title" required maxLength={120} value={form.title} onChange={set('title')} placeholder="Meeting name" {...fieldA11y('title')} />
                {fieldError('title')}
              </div>

              <div className="scheduler-fields">
                <div className="scheduler-field">
                  <label htmlFor="scheduler-date">Date</label>
                  <input id="scheduler-date" type="date" required min={dateInTimezone(Date.now(), timezone)} value={form.date} onChange={set('date')} {...fieldA11y('date')} />
                  {fieldError('date')}
                </div>
                <div className="scheduler-field">
                  <label htmlFor="scheduler-time">Time</label>
                  <input id="scheduler-time" type="time" required value={form.time} onChange={set('time')} {...fieldA11y('time')} />
                  {fieldError('time')}
                </div>
              </div>

              <p className="scheduler-timezone">Times in {timezone.replaceAll('_', ' ')}</p>

              <div className="scheduler-fields">
                <div className="scheduler-field">
                  <label htmlFor="scheduler-duration">Duration (minutes)</label>
                  <input id="scheduler-duration" type="number" required min="5" max="480" value={form.duration} onChange={set('duration')} {...fieldA11y('duration')} />
                  {fieldError('duration')}
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
                <input id="scheduler-participants" value={form.participants} onChange={set('participants')} placeholder="Email addresses" aria-invalid={!!fieldErrors.participants} aria-describedby={`scheduler-participant-help${fieldErrors.participants ? ' scheduler-participants-error' : ''}`} />
                {fieldError('participants')}
                <p className="scheduler-help" id="scheduler-participant-help">Separate email addresses with commas.</p>
              </div>

              {error && <p role="alert" className="scheduler-error">{error}</p>}

              <footer className="scheduler-actions">
                <button type="submit" className="scheduler-save" disabled={!form.title.trim() || saving}>
                  <CalendarClock size={17} aria-hidden="true" />{saving ? 'Saving…' : 'Save schedule'}
                </button>
                <button type="button" className="scheduler-invite" disabled={!form.title.trim() || saving} onClick={() => save('ics')} title="Save and download a calendar invite">
                  <Download size={17} aria-hidden="true" />Save + invite
                </button>
                <button type="button" className="scheduler-invite" disabled={!form.title.trim() || saving} onClick={() => save('google')} title="Save and add it to Google Calendar">
                  <CalendarPlus size={17} aria-hidden="true" />Save + Google
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
