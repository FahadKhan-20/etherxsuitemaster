import { useState } from 'react';

export default function ProfileAvatar({ src, name, initials, className, style }) {
  const [failedSource, setFailedSource] = useState(null);
  let source = null;
  try {
    const url = new URL(src);
    if (['https:', 'http:'].includes(url.protocol)) source = url.href;
  } catch { /* Missing or invalid photos use initials. */ }
  const showPhoto = source && source !== failedSource;

  return <span className={className} style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '50%', overflow: 'hidden', flexShrink: 0, ...style,
  }}>
    {showPhoto ? <img
      src={source}
      alt={`${name || 'Participant'}'s profile photo`}
      referrerPolicy="no-referrer"
      onError={() => setFailedSource(source)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    /> : initials}
  </span>;
}
