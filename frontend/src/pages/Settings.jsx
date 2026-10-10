import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Keyboard, Lock, Monitor, Moon, Palette, Shield, Sun, User, Video } from 'lucide-react';
import AnimatedPage from '../components/layout/AnimatedPage';
import WorkspaceHeader from '../components/layout/WorkspaceHeader';
import apiClient, { getApiErrorMessage } from '../utils/apiClient';
import { ROUTES } from '../utils/constants';
import { useUserContext } from '../context/UserContext';
import { useTheme } from '../utils/theme';
import { useMeetingPreferences } from '../hooks/useMeetingPreferences';
import { listMeetingDevices } from '../utils/meetingMedia';
import '../styles/dashboard.css';
import '../styles/settings.css';

// The shortcuts the meeting room actually handles (ReferenceVideoRoom), plus the app-wide command palette.
const KEYBOARD_SHORTCUTS = [
  { keys: ['M'], description: 'Mute or unmute your microphone' },
  { keys: ['V'], description: 'Turn your camera on or off' },
  { keys: ['H'], description: 'Raise or lower your hand' },
  { keys: ['C'], description: 'Open chat' },
  { keys: ['Space'], description: 'Push to talk while muted (hold)' },
  { keys: ['Ctrl / ⌘', 'E'], description: 'Leave the meeting' },
  { keys: ['Esc'], description: 'Close panels and menus' },
  { keys: ['Ctrl / ⌘', 'K'], description: 'Command palette (outside meetings)' },
];

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'devices', label: 'Audio & video', icon: Video },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
];

const SIGN_IN_METHODS = { local: 'Email and password', google: 'Google', apple: 'Apple', wallet: 'Wallet', email_passwordless: 'Email link', discord: 'Discord' };

export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser } = useUserContext();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');

  // Back to the page that opened Settings; a direct visit has no such page, so go to the dashboard.
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate(ROUTES.DASHBOARD));

  // Account data and preferences live on the server, so they follow the user and change real behaviour.
  const [account, setAccount] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    apiClient.get('/api/auth/me')
      .then((res) => setAccount(res.data?.data?.user || {}))
      .catch(() => { setAccount({}); setLoadError('Could not load your account settings.'); });
  }, []);
  const flash = (message) => { setStatus(message); setTimeout(() => setStatus((s) => (s === message ? '' : s)), 2500); };

  const preference = (group, key, fallback) => account?.preferences?.[group]?.[key] ?? fallback;
  const savePreference = async (group, key, value) => {
    const previous = account;
    setAccount((a) => ({ ...a, preferences: { ...a?.preferences, [group]: { ...a?.preferences?.[group], [key]: value } } }));
    try {
      const res = await apiClient.put('/api/auth/me/preferences', { [group]: { [key]: value } });
      setAccount((a) => ({ ...a, preferences: res.data.data.preferences }));
      flash('Saved.');
    } catch {
      setAccount(previous);
      flash('Could not save. Try again.');
    }
  };
  const toggleReminders = async (on) => {
    if (on && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission().catch(() => {});
    savePreference('reminders', 'enabled', on);
  };

  // Profile form: Save sends only what changed; Cancel puts back the saved values.
  const saved = { name: account?.name ?? user.name ?? '', email: account?.email ?? user.email ?? '' };
  const [form, setForm] = useState(null);
  const values = form ?? saved;
  const dirty = form && (form.name.trim() !== saved.name || form.email.trim().toLowerCase() !== (saved.email || ''));
  const [saving, setSaving] = useState(false);
  const saveProfile = async () => {
    if (!values.name.trim()) return flash('Enter your name.');
    setSaving(true);
    try {
      const res = await apiClient.put('/api/auth/me', { name: values.name.trim(), email: values.email.trim() });
      const next = res.data.data.user;
      setAccount((a) => ({ ...a, ...next }));
      updateUser({ name: next.name, email: next.email });
      setForm(null);
      flash('Profile saved.');
    } catch (error) {
      flash(getApiErrorMessage(error, 'Could not save your profile.'));
    } finally {
      setSaving(false);
    }
  };

  // Password: the same emailed reset link as "Forgot password?", so it also lets Google-only accounts add one.
  const [resetState, setResetState] = useState('idle'); // idle | sending | sent
  const sendResetLink = async () => {
    setResetState('sending');
    try {
      await apiClient.post('/api/auth/forgot-password', { email: saved.email });
      setResetState('sent');
    } catch (error) {
      setResetState('idle');
      flash(getApiErrorMessage(error, 'Could not send the reset link. Try again.'));
    }
  };

  // Device and in-meeting alert choices are per browser and shared with the meeting room's own settings.
  const [meetingPrefs, saveMeetingPrefs] = useMeetingPreferences();
  const roomPref = (key, fallback) => meetingPrefs.reference?.[key] ?? fallback;
  const setRoomPref = (key, value) => { saveMeetingPrefs({ ...meetingPrefs, reference: { ...meetingPrefs.reference, [key]: value } }); flash('Saved on this browser.'); };
  const [devices, setDevices] = useState({ microphones: [], cameras: [], speakers: [] });
  const loadDevices = async () => { try { setDevices(await listMeetingDevices()); } catch { /* device list optional */ } };
  useEffect(() => { loadDevices(); }, []);
  const askDeviceAccess = async () => {
    try { (await navigator.mediaDevices.getUserMedia({ audio: true, video: true })).getTracks().forEach((t) => t.stop()); } catch { /* user declined */ }
    loadDevices();
  };
  const namedDevices = [...devices.microphones, ...devices.cameras].some((d) => d.label);
  const setDevice = (kind, id) => { saveMeetingPrefs({ ...meetingPrefs, devices: { ...meetingPrefs.devices, [kind]: id } }); flash('Saved on this browser.'); };

  return (
    <AnimatedPage>
      <div className="dashboard-page">
        <a className="dashboard-skip-link" href="#settings-content">Skip to content</a>
        <WorkspaceHeader />
        <main className="dashboard-content settings-content" id="settings-content">
          <button type="button" className="settings-back" onClick={goBack}><ArrowLeft size={16} aria-hidden="true" />Back</button>
          <div className="dashboard-heading">
            <h1>Settings</h1>
            {status && <p className="settings-status" role="status">{status}</p>}
          </div>
          {loadError && <p className="dashboard-error settings-error" role="alert">{loadError}</p>}

          <div className="settings-layout">
            <nav className="settings-tabs" role="tablist" aria-label="Settings sections">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" role="tab" id={`settings-tab-${id}`} aria-selected={activeTab === id} aria-controls="settings-panel" onClick={() => setActiveTab(id)}>
                  <Icon size={17} aria-hidden="true" />{label}
                </button>
              ))}
            </nav>

            <div className="settings-panels" id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${activeTab}`}>
              {activeTab === 'profile' && (
                <>
                  <Panel title="Profile" description="How you appear in meetings and invitations">
                    <div className="settings-grid">
                      <Field label="Full name" id="settings-name">
                        <input id="settings-name" value={values.name} onChange={(e) => setForm({ ...values, name: e.target.value })} autoComplete="name" />
                      </Field>
                      <Field label="Email" id="settings-email">
                        <input id="settings-email" type="email" value={values.email || ''} onChange={(e) => setForm({ ...values, email: e.target.value })} autoComplete="email" />
                      </Field>
                    </div>
                    <div className="settings-actions">
                      <button type="button" className="dashboard-button dashboard-button-primary" onClick={saveProfile} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save changes'}</button>
                      <button type="button" className="dashboard-button dashboard-button-secondary" onClick={() => setForm(null)} disabled={!dirty || saving}>Cancel</button>
                    </div>
                  </Panel>
                  {saved.email && (
                    <Panel title="Password" description={account?.authProvider === 'local' ? 'Change the password you sign in with' : 'Add a password so you can also sign in with your email'}>
                      <p className="settings-text">We email a reset link to <strong>{saved.email}</strong>. It works for one hour.</p>
                      <div className="settings-actions">
                        <button type="button" className="dashboard-button dashboard-button-secondary" onClick={sendResetLink} disabled={resetState !== 'idle'}>
                          {resetState === 'sent' ? 'Link sent — check your inbox' : resetState === 'sending' ? 'Sending…' : 'Email me a reset link'}
                        </button>
                      </div>
                    </Panel>
                  )}
                  <Panel title="Account" description="Read-only details of this account">
                    <dl className="settings-facts">
                      <div><dt>Sign-in method</dt><dd>{SIGN_IN_METHODS[account?.authProvider] || '—'}</dd></div>
                      <div><dt>Member since</dt><dd>{account?.createdAt ? new Date(account.createdAt).toLocaleDateString([], { dateStyle: 'long' }) : '—'}</dd></div>
                      <div><dt>Plan</dt><dd>Free</dd></div>
                    </dl>
                  </Panel>
                </>
              )}

              {activeTab === 'devices' && (
                <>
                  {!namedDevices && (
                    <p className="settings-note">
                      Your browser hides device names until you allow camera and microphone access.{' '}
                      <button type="button" className="settings-link" onClick={askDeviceAccess}>Allow access</button>
                    </p>
                  )}
                  <Panel title="Devices" description="Used when you join a meeting. Saved on this browser.">
                    <div className="settings-grid">
                      <Field label="Microphone" id="settings-mic">
                        <select id="settings-mic" value={meetingPrefs.devices.audio || 'default'} onChange={(e) => setDevice('audio', e.target.value)}>
                          <option value="default">System default</option>
                          {devices.microphones.filter((d) => d.deviceId && d.deviceId !== 'default').map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>)}
                        </select>
                      </Field>
                      <Field label="Speaker" id="settings-speaker">
                        <select id="settings-speaker" value={meetingPrefs.outputDevice || 'default'} onChange={(e) => { saveMeetingPrefs({ ...meetingPrefs, outputDevice: e.target.value }); flash('Saved on this browser.'); }}>
                          <option value="default">System default</option>
                          {devices.speakers.filter((d) => d.deviceId && d.deviceId !== 'default').map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${i + 1}`}</option>)}
                        </select>
                      </Field>
                      <Field label="Camera" id="settings-camera">
                        <select id="settings-camera" value={meetingPrefs.devices.video || ''} onChange={(e) => setDevice('video', e.target.value)}>
                          <option value="">System default</option>
                          {devices.cameras.filter((d) => d.deviceId).map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
                        </select>
                      </Field>
                    </div>
                  </Panel>
                  <Panel title="Video" description="What you send to others">
                    <Toggle label="Send HD video" description="720p. Turn off on slow connections to send 360p." checked={roomPref('hd', true)} onChange={(v) => setRoomPref('hd', v)} />
                    <Toggle label="Blur my background" description="Start every meeting with a blurred background." checked={roomPref('bg', 'none') === 'blur'} onChange={(v) => setRoomPref('bg', v ? 'blur' : 'none')} />
                  </Panel>
                  <Panel title="Audio processing" description="Applied by your browser">
                    <p className="settings-text">Echo cancellation and automatic gain are always on. Noise suppression is on when you join; turn it off during a meeting from More → Noise suppression.</p>
                  </Panel>
                </>
              )}

              {activeTab === 'appearance' && (
                <Panel title="Theme" description="Applies across EtherX Meet on this browser">
                  <div className="settings-themes" role="radiogroup" aria-label="Theme">
                    {[{ id: 'light', label: 'Light', icon: Sun }, { id: 'dark', label: 'Dark', icon: Moon }, { id: 'system', label: 'System', icon: Monitor }].map(({ id, label, icon: Icon }) => (
                      <button key={id} type="button" role="radio" aria-checked={theme === id} onClick={() => setTheme(id)}>
                        <Icon size={22} aria-hidden="true" />{label}
                      </button>
                    ))}
                  </div>
                </Panel>
              )}

              {activeTab === 'notifications' && (
                <>
                  <Panel title="During meetings" description="Saved on this browser. The same switches are in the meeting's settings.">
                    <Toggle label="Join and leave alerts" description="Show a notice when people enter or leave." checked={roomPref('sounds', true)} onChange={(v) => setRoomPref('sounds', v)} />
                    <Toggle label="Chat alerts" description="Show a preview when a message arrives." checked={roomPref('chatNotif', true)} onChange={(v) => setRoomPref('chatNotif', v)} />
                    <Toggle label="Raised hand alerts" description="Show a notice when someone raises their hand." checked={roomPref('handNotif', true)} onChange={(v) => setRoomPref('handNotif', v)} />
                  </Panel>
                  <Panel title="Meeting reminders" description="For meetings you schedule, while EtherX Meet is open">
                    <Toggle label="Remind me before scheduled meetings" description="In-app notice, plus a desktop notification if you allow them." checked={preference('reminders', 'enabled', true)} onChange={toggleReminders} />
                    <Field label="Remind me" id="settings-reminder">
                      <select id="settings-reminder" value={preference('reminders', 'minutes', 15)} disabled={!preference('reminders', 'enabled', true)} onChange={(e) => savePreference('reminders', 'minutes', Number(e.target.value))}>
                        <option value={5}>5 minutes before</option>
                        <option value={15}>15 minutes before</option>
                        <option value={30}>30 minutes before</option>
                        <option value={60}>1 hour before</option>
                      </select>
                    </Field>
                  </Panel>
                </>
              )}

              {activeTab === 'privacy' && (
                <>
                  <Panel title="Data retention" description="Your recordings and the history of meetings you host">
                    <Field label="Delete automatically after" id="settings-retention">
                      <select id="settings-retention" value={String(preference('privacy', 'retentionDays', null))} onChange={(e) => savePreference('privacy', 'retentionDays', e.target.value === 'null' ? null : Number(e.target.value))}>
                        <option value="null">Never — keep until I delete them</option>
                        <option value="30">30 days</option>
                        <option value="90">90 days</option>
                        <option value="365">1 year</option>
                      </select>
                    </Field>
                    <p className="settings-help">Older items are deleted permanently within a few hours of passing the limit.</p>
                  </Panel>
                  <Panel title="Recording" description="Meetings you host">
                    <Toggle label="Allow recording" description="When off, nobody can start or upload a recording in your meetings." checked={preference('privacy', 'allowRecording', true)} onChange={(v) => savePreference('privacy', 'allowRecording', v)} />
                  </Panel>
                  <Panel title="How your meetings are protected">
                    <p className="settings-text settings-lock"><Lock size={18} aria-hidden="true" />Audio and video travel directly between participants, encrypted in transit (WebRTC). Chat and shared files pass through the EtherX Meet server; recordings are stored privately and opened only through signed, expiring links.</p>
                  </Panel>
                </>
              )}

              {activeTab === 'shortcuts' && (
                <Panel title="Keyboard shortcuts" description="Work during a meeting unless noted">
                  <ul className="settings-shortcuts">
                    {KEYBOARD_SHORTCUTS.map((s) => (
                      <li key={s.description}><span>{s.description}</span><span>{s.keys.map((k) => <kbd key={k}>{k}</kbd>)}</span></li>
                    ))}
                  </ul>
                </Panel>
              )}
            </div>
          </div>
        </main>
      </div>
    </AnimatedPage>
  );
}

function Panel({ title, description, children }) {
  return (
    <section className="dashboard-panel settings-panel">
      <div className="dashboard-panel-heading settings-panel-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <div className="settings-panel-body">{children}</div>
    </section>
  );
}

function Field({ label, id, children }) {
  return <div className="settings-field"><label htmlFor={id}>{label}</label>{children}</div>;
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="settings-toggle">
      <div><p>{label}</p>{description && <span>{description}</span>}</div>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />
    </div>
  );
}
