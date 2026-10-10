import useLocalStorage from './useLocalStorage';
export const DEFAULT_MEETING_PREFERENCES = {
  captionLanguage: 'en-US', outputDevice: 'default',
  devices: { audio: 'default', video: '' }, filter: 'none', background: 'none',
  notifications: { sound: false, banners: true, desktop: false },
};
export function useMeetingPreferences() {
  const [stored, setPreferences] = useLocalStorage('etherx_meeting_preferences', DEFAULT_MEETING_PREFERENCES);
  return [{ ...DEFAULT_MEETING_PREFERENCES, ...stored,
    devices: { ...DEFAULT_MEETING_PREFERENCES.devices, ...stored?.devices },
    notifications: { ...DEFAULT_MEETING_PREFERENCES.notifications, ...stored?.notifications },
  }, setPreferences];
}
