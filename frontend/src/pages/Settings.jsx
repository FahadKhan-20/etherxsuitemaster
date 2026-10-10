import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import apiClient from '../utils/apiClient';
import { motion } from 'framer-motion';
import AnimatedPage from '../components/layout/AnimatedPage';
import { staggerContainer, staggerChild } from '../utils/animationVariants';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Moon,
  Sun,
  Monitor,
  Palette,
  Settings as SettingsIcon,
  Shield,
  Lock,
  Volume2,
  Mic,
  Video as VideoIcon,
  Keyboard,
  User,
  LogOut,
} from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import { ROUTES } from '../utils/constants';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Switch from '../components/ui/Switch';
import Tabs from '../components/ui/Tabs';
import { useUserContext } from '../context/UserContext';
import { useTheme } from '../utils/theme';
import { useMeetingPreferences } from '../hooks/useMeetingPreferences';
import { listMeetingDevices } from '../utils/meetingMedia';

const KEYBOARD_SHORTCUTS = [
  { keys: 'M', description: 'Mute/Unmute microphone' },
  { keys: 'V', description: 'Turn camera on/off' },
  { keys: 'S', description: 'Share screen' },
  { keys: 'R', description: 'Raise hand' },
  { keys: 'C', description: 'Open chat' },
  { keys: 'Cmd+K', description: 'Command palette' },
  { keys: 'Escape', description: 'Close panels' },
  { keys: 'Space', description: 'Push to talk (hold)' },
];

export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, updateUser } = useUserContext();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    title: user.title || '',
    timezone: user.timezone || 'UTC',
  });

  // Device and in-meeting alert choices are per browser and shared with the meeting room's own settings.
  const [meetingPrefs, saveMeetingPrefs] = useMeetingPreferences();
  const roomPref = (key, fallback) => meetingPrefs.reference?.[key] ?? fallback;
  const setRoomPref = (key, value) => saveMeetingPrefs({ ...meetingPrefs, reference: { ...meetingPrefs.reference, [key]: value } });
  const [devices, setDevices] = useState({ microphones: [], cameras: [], speakers: [] });
  const loadDevices = async () => { try { setDevices(await listMeetingDevices()); } catch { /* device list optional */ } };
  useEffect(() => { loadDevices(); }, []);
  const askDeviceAccess = async () => {
    try { (await navigator.mediaDevices.getUserMedia({ audio: true, video: true })).getTracks().forEach((t) => t.stop()); } catch { /* user declined */ }
    loadDevices();
  };
  const namedDevices = [...devices.microphones, ...devices.cameras].some((d) => d.label);

  // Account settings live on the server so they follow the user and change real behaviour.
  const [account, setAccount] = useState(null);
  const [accountStatus, setAccountStatus] = useState('');
  useEffect(() => {
    apiClient.get('/api/auth/me')
      .then((res) => setAccount(res.data?.data?.user?.preferences || {}))
      .catch(() => { setAccount({}); setAccountStatus('Could not load your account settings.'); });
  }, []);
  const accountValue = (group, key, fallback) => account?.[group]?.[key] ?? fallback;
  const saveAccount = async (group, key, value) => {
    const previous = account;
    setAccount((a) => ({ ...a, [group]: { ...a?.[group], [key]: value } }));
    setAccountStatus('');
    try {
      const res = await apiClient.put('/api/auth/me/preferences', { [group]: { [key]: value } });
      setAccount(res.data.data.preferences);
      setAccountStatus('Saved.');
      setTimeout(() => setAccountStatus(''), 2000);
    } catch {
      setAccount(previous);
      setAccountStatus('Could not save. Try again.');
    }
  };
  const toggleReminders = async (on) => {
    if (on && 'Notification' in window && Notification.permission === 'default') await Notification.requestPermission().catch(() => {});
    saveAccount('reminders', 'enabled', on);
  };

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  const handleProfileUpdate = async () => {
    setSaving(true);
    setSaveStatus('');
    try {
      const res = await apiClient.put('/api/auth/me', {
        name: formData.name,
        email: formData.email,
      });
      if (res.data.success) {
        updateUser(formData);
        setSaveStatus('Saved successfully.');
      }
    } catch {
      setSaveStatus('Failed to save. Please try again.');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
  };

  // Back to the page that opened Settings; a direct visit has no such page, so go to the dashboard.
  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate(ROUTES.DASHBOARD));

  return (
    <AnimatedPage>
    <div className="min-h-[100dvh] bg-black text-app-text" style={{ position: 'relative', background: 'var(--c-000000)' }}>
      <TopBar />

      <main className="mx-auto max-w-6xl px-3 py-6 pb-24 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <button
            type="button"
            onClick={goBack}
            className="mb-4 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-white/60 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
          <div className="flex items-center gap-3 mb-2">
            <SettingsIcon className="h-8 w-8 text-indigo-400" />
            <h1 className="text-4xl font-bold font-syne">Settings</h1>
          </div>
          <p className="text-white/50 mt-1">Manage your profile, devices, and preferences</p>
        </motion.div>

        <Tabs
          tabs={[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'audio', label: 'Audio', icon: Mic },
            { id: 'video', label: 'Video', icon: VideoIcon },
            { id: 'appearance', label: 'Appearance', icon: Palette },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'privacy', label: 'Privacy', icon: Shield },
            { id: 'shortcuts', label: 'Keyboard', icon: Keyboard },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <motion.div
          key={activeTab}
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="mt-8"
        >
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <motion.div variants={staggerChild} className="space-y-6">
              <SettingCard title="Profile Information" description="Update your account details">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Full Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Your name"
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="your@email.com"
                    />
                  </div>
                  <Input
                    label="Title/Role"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Product Manager"
                  />
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Timezone
                    </label>
                    <select className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white backdrop-blur-xl transition-colors hover:border-white/20 focus:border-indigo-400 focus:outline-none">
                      <option>UTC</option>
                      <option>EST (UTC-5)</option>
                      <option>CST (UTC-6)</option>
                      <option>PST (UTC-8)</option>
                      <option>GMT (UTC+0)</option>
                      <option>IST (UTC+5:30)</option>
                      <option>SGT (UTC+8)</option>
                    </select>
                  </div>
                </div>
              </SettingCard>

              <SettingCard title="Account Plan" description="Your current subscription">
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-white">EtherXMeet Pro</h4>
                      <p className="text-sm text-white/60 mt-1">
                        Unlimited meetings, advanced features, 1000 GB storage
                      </p>
                      <p className="text-xs text-emerald-300 mt-2">
                        Renews on May 8, 2026
                      </p>
                    </div>
                    <div className="rounded-full bg-emerald-400/20 px-4 py-2">
                      <span className="text-xs font-semibold text-emerald-300">Active</span>
                    </div>
                  </div>
                </div>
              </SettingCard>

              <div className="flex gap-4">
                <Button variant="primary" onClick={handleProfileUpdate} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
                <Button variant="ghost">Cancel</Button>
                {saveStatus && (
                  <span style={{ fontSize: 13, color: saveStatus.startsWith('Saved') ? 'var(--t-22c55e)' : 'var(--t-ef4444)', alignSelf: 'center' }}>
                    {saveStatus}
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* Audio Tab */}
          {activeTab === 'audio' && (
            <motion.div variants={staggerChild} className="space-y-6">
              {!namedDevices && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  Your browser hides device names until you allow camera and microphone access.{' '}
                  <button type="button" onClick={askDeviceAccess} className="font-semibold text-[var(--t-d4af37)] underline">Allow access</button>
                </div>
              )}
              <SettingCard title="Audio Input" description="Microphone used when you join a meeting">
                <label className="block text-sm font-medium text-white/80 mb-2" htmlFor="settings-mic">Microphone</label>
                <select id="settings-mic" value={meetingPrefs.devices.audio || 'default'} onChange={(e) => saveMeetingPrefs({ ...meetingPrefs, devices: { ...meetingPrefs.devices, audio: e.target.value } })} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white backdrop-blur-xl">
                  <option value="default">System default</option>
                  {devices.microphones.filter((d) => d.deviceId && d.deviceId !== 'default').map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>)}
                </select>
              </SettingCard>

              <SettingCard title="Audio Output" description="Speaker used for meeting audio">
                <label className="block text-sm font-medium text-white/80 mb-2" htmlFor="settings-speaker">Speaker</label>
                <select id="settings-speaker" value={meetingPrefs.outputDevice || 'default'} onChange={(e) => saveMeetingPrefs({ ...meetingPrefs, outputDevice: e.target.value })} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white backdrop-blur-xl">
                  <option value="default">System default</option>
                  {devices.speakers.filter((d) => d.deviceId && d.deviceId !== 'default').map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${i + 1}`}</option>)}
                </select>
              </SettingCard>

              <SettingCard title="Audio Processing" description="Applied by your browser">
                <p className="text-sm text-white/70">
                  Echo cancellation and automatic gain are always on. Noise suppression is on when you join; turn it off during a meeting from More → Noise suppression.
                </p>
              </SettingCard>
            </motion.div>
          )}

          {/* Video Tab */}
          {activeTab === 'video' && (
            <motion.div variants={staggerChild} className="space-y-6">
              <SettingCard title="Video Input" description="Camera used when you join a meeting">
                <label className="block text-sm font-medium text-white/80 mb-2" htmlFor="settings-camera">Camera</label>
                <select id="settings-camera" value={meetingPrefs.devices.video || ''} onChange={(e) => saveMeetingPrefs({ ...meetingPrefs, devices: { ...meetingPrefs.devices, video: e.target.value } })} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white backdrop-blur-xl">
                  <option value="">System default</option>
                  {devices.cameras.filter((d) => d.deviceId).map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
                </select>
              </SettingCard>

              <SettingCard title="Video Quality" description="What you send to others">
                <div className="space-y-4">
                  <SettingToggle label="Send HD video" description="720p; turn off on slow connections to send 360p" enabled={roomPref('hd', true)} onChange={(v) => setRoomPref('hd', v)} />
                  <SettingToggle label="Blur my background" description="Start every meeting with a blurred background" enabled={roomPref('bg', 'none') === 'blur'} onChange={(v) => setRoomPref('bg', v ? 'blur' : 'none')} />
                </div>
              </SettingCard>
            </motion.div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <motion.div variants={staggerChild} className="space-y-6">
              <SettingCard title="Theme" description="Choose your preferred appearance">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 'light', label: 'Light', icon: Sun },
                    { id: 'dark', label: 'Dark', icon: Moon },
                    { id: 'system', label: 'System', icon: Monitor },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleThemeChange(t.id)}
                      className={`rounded-lg border-2 p-4 transition-all ${
                        theme === t.id
                          ? 'border-indigo-400 bg-indigo-400/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <t.icon className="h-6 w-6 mx-auto mb-2 text-white" />
                      <div className="font-semibold text-white">{t.label}</div>
                    </button>
                  ))}
                </div>
              </SettingCard>

              <SettingCard title="Accent Color" description="Customize primary color">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  {[
                    { name: 'Indigo', color: 'bg-indigo-500' },
                    { name: 'Cyan', color: 'bg-cyan-500' },
                    { name: 'Emerald', color: 'bg-emerald-500' },
                    { name: 'Purple', color: 'bg-purple-500' },
                    { name: 'Rose', color: 'bg-rose-500' },
                    { name: 'Amber', color: 'bg-amber-500' },
                  ].map((accent) => (
                    <button
                      key={accent.name}
                      className={`h-12 rounded-lg border-2 border-white/10 transition-all hover:border-white/30 ${accent.color}`}
                      title={accent.name}
                    />
                  ))}
                </div>
              </SettingCard>

              <SettingCard title="Accessibility" description="Improve usability">
                <div className="space-y-4">
                  <SettingToggle
                    label="High Contrast Mode"
                    description="Increase contrast for better visibility"
                    enabled={false}
                  />
                  <SettingToggle
                    label="Large Font Size"
                    description="Increase text size globally"
                    enabled={false}
                  />
                  <SettingToggle
                    label="Reduce Motion"
                    description="Minimize animations"
                    enabled={false}
                  />
                </div>
              </SettingCard>
            </motion.div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <motion.div variants={staggerChild} className="space-y-6">
              <SettingCard title="During meetings" description="Saved on this browser; the same switches are in the meeting's Settings">
                <div className="space-y-4">
                  <SettingToggle label="Join and leave alerts" description="Show a notice when people enter or leave" enabled={roomPref('sounds', true)} onChange={(v) => setRoomPref('sounds', v)} />
                  <SettingToggle label="Chat alerts" description="Show a preview when a message arrives" enabled={roomPref('chatNotif', true)} onChange={(v) => setRoomPref('chatNotif', v)} />
                  <SettingToggle label="Raised hand alerts" description="Show a notice when someone raises their hand" enabled={roomPref('handNotif', true)} onChange={(v) => setRoomPref('handNotif', v)} />
                </div>
              </SettingCard>

              <SettingCard title="Meeting reminders" description="For meetings you schedule; shown while EtherX Meet is open">
                <div className="space-y-4">
                  <SettingToggle label="Remind me before scheduled meetings" description="In-app notice, plus a desktop notification if you allow them" enabled={accountValue('reminders', 'enabled', true)} onChange={toggleReminders} />
                  <div>
                    <label className="text-sm font-medium text-white/80 mb-2 block" htmlFor="settings-reminder">Remind me</label>
                    <select id="settings-reminder" value={accountValue('reminders', 'minutes', 15)} disabled={!accountValue('reminders', 'enabled', true)} onChange={(e) => saveAccount('reminders', 'minutes', Number(e.target.value))} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white backdrop-blur-xl">
                      <option value={5}>5 minutes before</option>
                      <option value={15}>15 minutes before</option>
                      <option value={30}>30 minutes before</option>
                      <option value={60}>1 hour before</option>
                    </select>
                  </div>
                  {accountStatus && <p role="status" className="text-sm text-white/70">{accountStatus}</p>}
                </div>
              </SettingCard>
            </motion.div>
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && (
            <motion.div variants={staggerChild} className="space-y-6">
              <SettingCard title="Data retention" description="Applies to your recordings and the history of meetings you host">
                <label className="text-sm font-medium text-white/80 mb-2 block" htmlFor="settings-retention">Delete automatically after</label>
                <select id="settings-retention" value={String(accountValue('privacy', 'retentionDays', null))} onChange={(e) => saveAccount('privacy', 'retentionDays', e.target.value === 'null' ? null : Number(e.target.value))} className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white backdrop-blur-xl">
                  <option value="null">Never — keep until I delete them</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                </select>
                <p className="text-xs text-white/65 mt-2">Older items are deleted permanently within a few hours of passing the limit.</p>
              </SettingCard>

              <SettingCard title="Recordings" description="Meetings you host">
                <SettingToggle label="Allow recording" description="When off, nobody can start or upload a recording in your meetings" enabled={accountValue('privacy', 'allowRecording', true)} onChange={(v) => saveAccount('privacy', 'allowRecording', v)} />
                {accountStatus && <p role="status" className="text-sm text-white/70 mt-3">{accountStatus}</p>}
              </SettingCard>

              <SettingCard title="Security" description="How your meetings are protected">
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start gap-3">
                    <Lock className="h-5 w-5 text-[var(--t-d4af37)] shrink-0 mt-0.5" />
                    <p className="text-sm text-white/70">
                      Audio and video travel directly between participants, encrypted in transit (WebRTC). Chat, shared files and recordings pass through and are stored on the EtherX Meet server.
                    </p>
                  </div>
                </div>
              </SettingCard>
            </motion.div>
          )}

          {/* Keyboard Shortcuts Tab */}
          {activeTab === 'shortcuts' && (
            <motion.div variants={staggerChild} className="space-y-6">
              <SettingCard
                title="Keyboard Shortcuts"
                description="Quick access to common actions"
              >
                <div className="rounded-lg border border-white/10 divide-y divide-white/10 overflow-hidden">
                  {KEYBOARD_SHORTCUTS.map((shortcut) => (
                    <div
                      key={shortcut.keys}
                      className="flex items-center justify-between bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors"
                    >
                      <span className="text-white/70">{shortcut.description}</span>
                      <div className="flex gap-2">
                        {shortcut.keys.split('+').map((key, i) => (
                          <span key={key}>
                            {i > 0 && <span className="text-white/40 mx-1">+</span>}
                            <kbd className="rounded bg-white/10 px-2 py-1 text-xs font-semibold text-white border border-white/20">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </SettingCard>

              <SettingCard title="Custom Shortcuts" description="Customize your keybindings">
                <p className="text-white/60 text-sm">
                  Right now, default shortcuts are fixed. Custom rebinding coming soon!
                </p>
              </SettingCard>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
    </AnimatedPage>
  );
}

/**
 * Reusable settings card component
 */
function SettingCard({ title, description, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-6 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--c-ffffff)_8%,transparent)] backdrop-blur-xl">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        <p className="text-sm text-white/65 mt-1">{description}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Reusable toggle setting component
 */
function SettingToggle({ label, description, enabled = false, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-white font-medium">{label}</p>
        <p className="text-sm text-white/65 mt-1">{description}</p>
      </div>
      <Switch checked={enabled} onChange={onChange} />
    </div>
  );
}
