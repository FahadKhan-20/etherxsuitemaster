import { useEffect, useRef } from 'react';
import { MonitorUp } from 'lucide-react';
import VideoTile from '../video/VideoTile';

function ScreenPreview({ stream, onStop }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) { ref.current.srcObject = stream; ref.current.play().catch(() => {}); } }, [stream]);
  return <div className="exmeet-tile exmeet-screen" data-screen-preview>
    {stream ? <video ref={ref} autoPlay muted playsInline/> : <div className="exmeet-tile-empty"><MonitorUp size={40}/><h2>You're presenting your screen</h2></div>}
    <div className="exmeet-screen-label"><span>Your screen</span><button onClick={onStop}>Stop sharing</button></div>
  </div>;
}

export default function RoomStage({ localStream, peers, userName, micMuted, cameraOff, selfViewHidden,
  filter, background, gridView, spotlightId, setSpotlightId, screenStream, isScreenSharing, onStopScreen,
  screenSharerId, handQueue, mySocketId, canHost, isCoHost, coHost, account, copied, onCopyLink, roomCode }) {
  const peerList = Object.entries(peers);
  const name = userName || 'You';
  const handPosition = id => handQueue.findIndex(hand => hand.socketId === id) + 1;
  const local = { id: 'self', stream: localStream, name, local: true, muted: micMuted, cameraOff,
    badge: canHost ? isCoHost ? 'Co-host' : 'Host' : undefined };
  const people = [local, ...peerList.map(([id, peer]) => ({ id, stream: peer.stream, name: peer.userName || 'Guest',
    muted: !!peer.isMuted, cameraOff: !!peer.videoOff && id !== screenSharerId,
    badge: id === screenSharerId ? 'Presenting' : coHost?.socketId === id ? 'Co-host' : peer.isHost ? 'Host' : undefined }))];
  const focused = people.find(person => person.id === spotlightId) || local;
  const presenting = isScreenSharing || !!screenSharerId;
  const primary = presenting && screenSharerId ? people.find(person => person.id === screenSharerId) || focused : focused;
  const thumbnails = people.filter(person => isScreenSharing || person.id !== primary.id);
  const link = `${window.location.host}/room/${encodeURIComponent(roomCode)}`;
  const renderPerson = (person, small = false, clickable = false) => <VideoTile key={person.id}
    stream={person.stream} userName={person.name} isLocal={!!person.local} isMuted={person.muted}
    isCameraOff={person.cameraOff} isSmall={small} hidden={!!person.local && selfViewHidden}
    filter={person.local ? filter : 'none'} bgImage={person.local ? background : 'none'}
    hasWallet={!!person.local && !!account} handPosition={handPosition(person.local ? mySocketId : person.id)}
    isHandRaised={handPosition(person.local ? mySocketId : person.id) > 0}
    badge={person.badge} fit={person.id === screenSharerId ? 'contain' : 'cover'}
    onClick={clickable ? () => setSpotlightId(person.local ? null : person.id) : undefined}>
    {peerList.length === 0 && !small && !selfViewHidden && <div className="exmeet-solo-invite">
      <h2>You're the only one here</h2><p>Share the link to invite others</p>
      <div className="exmeet-invite-link"><span>{link}</span><button title="Copy meeting link" onClick={event => { event.stopPropagation(); onCopyLink(); }}>{copied ? 'Copied!' : 'Copy link'}</button></div>
    </div>}
  </VideoTile>;

  return <div className={`exmeet-stage-grid${gridView && !presenting ? ' exmeet-stage-gallery' : ''}${thumbnails.length && (!gridView || presenting) ? ' exmeet-stage-speaker' : ''}`}
    data-participant-count={people.length}
    style={gridView && !presenting ? { '--exmeet-columns': people.length <= 1 ? 1 : people.length <= 4 ? 2 : people.length <= 9 ? 3 : 4,
      '--exmeet-mobile-columns': people.length <= 1 ? 1 : 2 } : undefined}>
    {gridView && !presenting ? people.map(person => renderPerson(person, false, peerList.length > 0)) : <>
      {isScreenSharing ? <ScreenPreview stream={screenStream} onStop={onStopScreen}/> : renderPerson(primary)}
      {thumbnails.length > 0 && <div className="exmeet-filmstrip">{thumbnails.map(person => renderPerson(person, true, true))}</div>}
    </>}
  </div>;
}
