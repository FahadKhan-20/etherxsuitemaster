import { useId, useRef, useState } from 'react';
import { X, Mic, Video, Image, Bell, Keyboard, SlidersHorizontal, User, Upload } from 'lucide-react';
import VideoCanvasProcessor from '../video/VideoCanvasProcessor';
import { useStreamLevel } from '../../hooks/useStreamLevel';
import { MEETING_BACKGROUNDS } from '../../utils/meetingBackgrounds';
import { playSpeakerTest } from '../../utils/meetingMedia';
import { useDialogFocus } from '../../hooks/useDialogFocus';

const TABS = [
  ['audio', 'Audio', Mic], ['video', 'Video', Video], ['backgrounds', 'Backgrounds', Image],
  ['notifications', 'Notifications', Bell], ['profile', 'Profile', User],
  ['shortcuts', 'Shortcuts', Keyboard], ['general', 'Appearance', SlidersHorizontal],
];

export default function MeetingSettings({ initialTab = 'audio', preferences, onSave, onClose, stream, audioEnabled, videoEnabled, devices, selectedDevices, switchDevice, name, onNameChange }) {
  const [tab, setTab] = useState(initialTab);
  const [draft, setDraft] = useState(() => ({ ...preferences, devices: { ...preferences.devices, ...selectedDevices }, notifications: { ...preferences.notifications } }));
  const [draftName, setDraftName] = useState(name || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const ref = useRef(null), uploadRef = useRef(null);
  const titleId = useId();
  const level = useStreamLevel(stream, audioEnabled && tab === 'audio');
  const patch = updates => setDraft(prev => ({ ...prev, ...updates }));
  const canRouteOutput = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

  useDialogFocus(ref, () => { if (!saving) onClose(); });

  const apply = async () => {
    setSaving(true); setError('');
    try {
      if (draft.notifications.desktop) {
        if (!('Notification' in window)) throw new Error('Desktop notifications are unavailable in this browser.');
        if (await Notification.requestPermission() !== 'granted') throw new Error('Allow desktop notifications, or turn this option off.');
      }
      for (const kind of ['audio', 'video']) {
        if (draft.devices[kind] != null && draft.devices[kind] !== selectedDevices?.[kind]) await switchDevice(kind, draft.devices[kind]);
      }
      onSave(draft);
      if (onNameChange && draftName.trim()) onNameChange(draftName.trim());
      onClose();
    } catch (e) { setError(e.message || 'Could not apply settings. Your current call stays connected.'); }
    finally { setSaving(false); }
  };
  const testOutput = async () => {
    setTesting(true); setError('');
    try { await playSpeakerTest(draft.outputDevice); } catch (e) { setError(e.message); }
    finally { setTesting(false); }
  };
  const addBackground = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setError('Choose a PNG, JPEG, or WebP image under 4 MB.'); return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      patch({ background: canvas.toDataURL('image/jpeg', 0.82), filter: 'none' }); setError('');
    } catch { setError('This image could not be opened. Choose another image.'); }
  };

  return <div className="meeting-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
    <section ref={ref} className="meeting-settings" role="dialog" aria-modal="true" aria-labelledby={titleId} data-meeting-theme={preferences.theme}>
      <header className="meeting-settings-header"><div><p className="meeting-eyebrow">MAKE IT YOURS</p><h2 id={titleId}>Meeting settings</h2></div><button type="button" aria-label="Close settings" onClick={onClose} disabled={saving}><X size={24} /></button></header>
      <nav className="meeting-settings-tabs" aria-label="Settings sections">{TABS.map(([id, label, Icon]) => <button type="button" key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}><Icon size={21}/><span>{label}</span></button>)}</nav>
      <div className="meeting-settings-content">
        {tab === 'audio' && <><h3>Sound that works for you</h3><label>Microphone<select value={draft.devices.audio || 'default'} onChange={e => patch({ devices: { ...draft.devices, audio: e.target.value } })}><option value="default">System default microphone</option>{devices.microphones.filter(d => d.deviceId !== 'default').map((d,i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i+1}`}</option>)}</select></label><div className="meeting-level" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>{Array.from({length:12},(_,i)=><span key={i} data-active={level > i / 12}/>)}</div><p className="meeting-help">{audioEnabled ? 'Speak to check your microphone level.' : 'Microphone is muted. Unmute to test your voice.'}</p><label>Speaker<select disabled={!canRouteOutput} value={draft.outputDevice} onChange={e=>patch({outputDevice:e.target.value})}><option value="default">System default speaker</option>{canRouteOutput && devices.speakers.filter(d=>d.deviceId !== 'default').map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${i+1}`}</option>)}</select></label>{!canRouteOutput && <p className="meeting-help">Choose your speaker in system settings for this browser.</p>}<button type="button" className="meeting-secondary" onClick={testOutput} disabled={testing}>{testing ? 'Playing tone…' : 'Test speaker'}</button></>}
        {tab === 'video' && <><h3>Your camera</h3><label>Camera<select value={draft.devices.video || ''} onChange={e=>patch({devices:{...draft.devices, video:e.target.value}})}><option value="">System default camera</option>{devices.cameras.map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i+1}`}</option>)}</select></label><p className="meeting-help">Camera selection applies to your live call. Your camera stays off if you turned it off.</p></>}
        {tab === 'backgrounds' && <><h3>Your space, your choice</h3><div className="meeting-settings-preview">{stream && videoEnabled ? <VideoCanvasProcessor stream={stream} activeFilter={draft.filter} selectedBgImage={draft.background} mirror/> : <div className="meeting-preview-off">Camera is off</div>}</div><button type="button" className="meeting-secondary" onClick={()=>uploadRef.current.click()}><Upload size={18}/> Add background</button><input ref={uploadRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={addBackground} hidden/><div className="meeting-background-grid">{MEETING_BACKGROUNDS.map(bg=><button type="button" key={bg.id} aria-label={bg.label} aria-pressed={bg.type === 'image' ? draft.background === bg.url : draft.background === 'none' && draft.filter === bg.id} onClick={()=>patch({background:bg.type === 'image' ? bg.url : 'none',filter:bg.type === 'filter' ? bg.id : 'none'})} style={bg.url ? {backgroundImage:`url("${bg.url}")`} : undefined}><span>{bg.label}</span></button>)}</div><p className="meeting-help">Backgrounds and blur apply to video other participants receive.</p></>}
        {tab === 'notifications' && <><h3>Stay in the loop</h3>{[['sound','Play sound when people join or leave'],['banners','Show join and leave banners'],['desktop','Notify me when this tab is in the background']].map(([key,label])=><label className="meeting-checkbox" key={key}><input type="checkbox" checked={draft.notifications[key]} onChange={e=>patch({notifications:{...draft.notifications,[key]:e.target.checked}})}/><span>{label}</span></label>)}</>}
        {tab === 'profile' && <><h3>Your profile</h3><label>Display name<input value={draftName} onChange={e=>setDraftName(e.target.value)} readOnly={!onNameChange} maxLength={80}/></label><p className="meeting-help">{onNameChange ? 'This name appears when you join.' : 'Your current meeting name.'}</p></>}
        {tab === 'shortcuts' && <><h3>Keep your hands on the keyboard</h3>{[['M','Mute or unmute'],['V','Toggle camera'],['Hold Space','Push to talk while muted'],['Ctrl/⌘ + E','Leave meeting']].map(([key,label])=><div className="meeting-shortcut" key={key}><span>{label}</span><kbd>{key}</kbd></div>)}<p className="meeting-help">Shortcuts pause while you type or open a dialog.</p></>}
        {tab === 'general' && <><h3>A comfortable view</h3><label>Theme<select value={draft.theme} onChange={e=>patch({theme:e.target.value})}><option value="dark">Dark</option><option value="light">Light</option></select></label><label>Spoken language for live captions<select value={draft.captionLanguage} onChange={e=>patch({captionLanguage:e.target.value})}><option value="en-US">English</option><option value="es-ES">Español</option><option value="fr-FR">Français</option><option value="hi-IN">हिन्दी</option></select></label><p className="meeting-help">Your browser uses this language to recognize your speech.</p></>}
        {error && <p className="meeting-settings-error" role="alert">{error}</p>}
      </div>
      <footer className="meeting-settings-footer"><p>Saved on this device</p><button type="button" className="meeting-secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="button" className="meeting-primary" onClick={apply} disabled={saving}>{saving ? 'Applying…' : 'Apply settings'}</button></footer>
    </section>
  </div>;
}
