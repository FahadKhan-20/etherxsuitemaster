import { useRef, useState } from 'react';
import { X, MonitorUp } from 'lucide-react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

export default function ShareMediaDialog({ kind, onClose, onShare }) {
  const ref = useRef(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useDialogFocus(ref, onClose);
  const submit = event => {
    event.preventDefault();
    try {
      const parsed = new URL(url.trim());
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error();
      onShare(parsed.href); onClose();
    } catch { setError('Enter a valid http or https URL.'); }
  };
  return <div className="meeting-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="exmeet-dialog exmeet-share-dialog" ref={ref} role="dialog" aria-modal="true" aria-label={`Share ${kind}`}>
      <header><h2><MonitorUp size={20}/> Share {kind}</h2><button type="button" className="meeting-icon-button" aria-label="Close media sharing" onClick={onClose}><X size={18}/></button></header>
      <p>Play {kind} for everyone in this meeting. Paste a link to a media file{kind === 'video' ? ' or YouTube video' : ''}.</p>
      <form onSubmit={submit}><label htmlFor="meeting-media-url">Media URL</label>
        <input id="meeting-media-url" type="url" placeholder="https://…" required value={url} onChange={event => { setUrl(event.target.value); setError(''); }}/>
        {error && <p role="alert" className="meeting-settings-error">{error}</p>}
        <footer><button type="button" className="meeting-secondary" onClick={onClose}>Cancel</button><button type="submit" className="meeting-primary" disabled={!url.trim()}>Share with everyone</button></footer>
      </form>
    </section>
  </div>;
}
