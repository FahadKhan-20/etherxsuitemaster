import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { useMediaDevices } from '../src/hooks/useMediaDevices';
import { useWebRTC } from '../src/hooks/useWebRTC';
import { acquireMeetingMedia } from '../src/utils/meetingMedia';
import { DEFAULT_MEETING_PREFERENCES, useMeetingPreferences } from '../src/hooks/useMeetingPreferences';
import MeetingSettings from '../src/components/room/MeetingSettings';
import ReferenceVideoRoom from '../src/components/room/ReferenceVideoRoom';
import VideoRoom from '../src/components/video/VideoRoom';
import RoomStage from '../src/components/room/RoomStage';
import RoomMoreMenu from '../src/components/room/RoomMoreMenu';
import VideoTile from '../src/components/video/VideoTile';
import * as streamMeter from '../src/hooks/useStreamLevel';
import VerifiedChat from '../src/components/web3/VerifiedChat';
import apiClient from '../src/utils/apiClient';
import { useStreamLevel } from '../src/hooks/useStreamLevel';
import { copyMeetingText } from '../src/utils/meetingClipboard';

const { sockets } = vi.hoisted(() => ({ sockets: [] }));
vi.mock('socket.io-client', () => ({ io: vi.fn((_url, options) => {
  const handlers = new Map();
  const socket = { id: 'self', connected: true, options, events: [],
    on(event, handler) { handlers.set(event, handler); return socket; },
    off(event) { handlers.delete(event); },
    emit(event, payload, acknowledge) { socket.events.push({ event, payload }); acknowledge?.({ok:true}); },
    trigger(event, payload) { return handlers.get(event)?.(payload); },
    disconnect() { socket.connected = false; },
  };
  sockets.push(socket); queueMicrotask(() => socket.trigger('connect')); return socket;
}) }));
vi.mock('../src/utils/apiClient', () => ({ default: { get: vi.fn(async () => ({ data: { data: [] } })), post: vi.fn(async () => ({ data: {} })) } }));
class Track {
  constructor(kind, deviceId = 'default') { this.kind = kind; this.label = deviceId; this.enabled = true; this.readyState = 'live'; }
  clone() { const copy=new Track(this.kind,this.label);copy.enabled=this.enabled;return copy; }
  async applyConstraints() {}
  stop() { this.readyState = 'ended'; }
  getSettings() { return { deviceId: this.label }; }
}
class Stream {
  constructor(tracks = []) { this.tracks = [...tracks]; }
  getTracks() { return [...this.tracks]; }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  addTrack(track) { if (!this.tracks.includes(track)) this.tracks.push(track); }
  removeTrack(track) { this.tracks = this.tracks.filter(t => t !== track); }
}
const pcs = [], captures = [];
class PC {
  constructor() { this.transceivers = []; this.signalingState = 'stable'; this.connectionState = 'new'; pcs.push(this); }
  addTrack(track) { const sender = { track, replaceTrack: async next => { sender.track = next; } }; this.transceivers.push({ sender, receiver: { track: { kind: track.kind } }, mid: '0', direction: 'sendrecv', currentDirection: 'sendrecv' }); return sender; }
  addTransceiver(kind) { const sender = { track: null, replaceTrack: async next => { sender.track = next; } }; this.transceivers.push({ sender, receiver: { track: { kind } }, mid: '0', currentDirection: 'sendrecv' }); }
  getTransceivers() { return this.transceivers; }
  getSenders() { return this.transceivers.map(t=>t.sender); }
  async createOffer() { return { type: 'offer', sdp: 'test' }; }
  async setLocalDescription() {}
  close() { this.connectionState = 'closed'; }
}
let roots = [], hook;
function mount(element) {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container); roots.push({root,container});
  act(() => root.render(element));
  return { container, rerender: element => act(() => root.render(element)), unmount: () => { act(()=>root.unmount()); roots = roots.filter(r=>r.root !== root); container.remove(); } };
}
function renderHook(fn, strict = false) {
  function Probe() { hook = fn(); return null; }
  const element = () => strict ? <StrictMode><Probe/></StrictMode> : <Probe/>;
  const rendered = mount(element());
  return { ...rendered, rerender: () => rendered.rerender(element()) };
}
async function settle() { await act(async()=>{ await new Promise(resolve=>setTimeout(resolve,0)); }); }
function typeInput(element,value) { act(()=>{ Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,value); element.dispatchEvent(new Event('input',{bubbles:true})); }); }
function clickTitle(title) { const btn=document.querySelector(`[title="${title}"]`);expect(btn).toBeTruthy();act(()=>btn.click()); }
function clickText(text) { const btn = [...document.querySelectorAll('button')].find(b=>b.textContent.trim() === text); expect(btn, `button ${text}`).toBeTruthy(); act(()=>btn.click()); }
const prefs = () => structuredClone(DEFAULT_MEETING_PREFERENCES);
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('MediaStream', Stream); vi.stubGlobal('RTCPeerConnection', PC);
  const storage = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key), clear: () => data.clear() }; };
  vi.stubGlobal('localStorage', storage()); vi.stubGlobal('sessionStorage', storage());
  sockets.length = 0; pcs.length = 0; captures.length = 0;
  vi.mocked(apiClient.get).mockReset().mockResolvedValue({data:{data:[]}});vi.mocked(apiClient.post).mockReset().mockResolvedValue({data:{}});
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('nexmeet_token','test-session'); localStorage.setItem('nexmeet_user',JSON.stringify({id:'user-1',name:'Audit User'}));
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{
    getUserMedia:vi.fn(async constraints=>{ const kind=constraints.video ? 'video':'audio'; const id=constraints[kind]?.deviceId?.exact || 'default'; const stream=new Stream([new Track(kind,id)]); captures.push(stream); return stream; }),
    enumerateDevices:vi.fn(async()=>[{kind:'audioinput',deviceId:'default',label:'Default mic'},{kind:'audioinput',deviceId:'mic-2',label:'Second mic'},{kind:'videoinput',deviceId:'cam-2',label:'Second camera'}]),
    addEventListener:vi.fn(),removeEventListener:vi.fn(),
  }});
  vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue();
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage(){},clearRect(){},save(){},restore(){},translate(){},scale(){},fillRect(){},getImageData(){return{data:[]}}});
});
afterEach(()=>{ for(const {root,container} of roots) { act(()=>root.unmount());container.remove(); }roots=[];vi.restoreAllMocks();vi.unstubAllGlobals(); });

describe('More menu navigation', () => {
  it('skips disabled actions, supports keyboard navigation, and restores trigger focus on Escape', () => {
    mount(<RoomMoreMenu groups={[{label:'Tools',items:[
      {label:'Whiteboard',action:vi.fn()}, {label:'Recording busy',disabled:true,action:vi.fn()},
      {label:'Settings',action:vi.fn()},
    ]}]}/>);
    clickTitle('More');
    expect(document.activeElement.textContent).toBe('Whiteboard');
    act(()=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true})));
    expect(document.activeElement.textContent).toBe('Settings');
    act(()=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true})));
    expect(document.activeElement.textContent).toBe('Whiteboard');
    act(()=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true})));
    expect(document.activeElement.textContent).toBe('Settings');
    act(()=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement.title).toBe('More');
  });
  it('closes on action and outside click while preserving toggle state', () => {
    const action=vi.fn();
    mount(<RoomMoreMenu groups={[{label:'Audio',items:[{label:'Noise suppression',active:true,action}]}]}/>);
    clickTitle('More');expect(document.querySelector('[role="menuitemcheckbox"]').getAttribute('aria-checked')).toBe('true');
    clickText('Noise suppression');expect(action).toHaveBeenCalledOnce();expect(document.querySelector('[role="menu"]')).toBeNull();
    clickTitle('More');act(()=>document.body.dispatchEvent(new Event('pointerdown',{bubbles:true})));
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});

describe('reference meeting layout', () => {
  it('starts in gallery view and keeps speaker layout available from More', async () => {
    mount(<MemoryRouter><VideoRoom roomCode="test-room" isHost preferences={prefs()} savePreferences={vi.fn()}/></MemoryRouter>);await settle();
    await act(async()=>sockets[0].trigger('existing-users',[{socketId:'peer',userName:'Priya Shah',videoOff:true}]));
    expect(document.querySelector('.exmeet-stage-gallery')).toBeTruthy();expect(document.querySelector('.exmeet-filmstrip')).toBeNull();
    clickTitle('More');clickText('Speaker view');expect(document.querySelector('.exmeet-stage-speaker')).toBeTruthy();
    clickTitle('More');clickText('Grid view');expect(document.querySelector('.exmeet-stage-gallery')).toBeTruthy();
    act(()=>document.querySelector('[aria-label="Spotlight Priya Shah"]').click());
    expect(document.querySelector('.exmeet-stage-speaker > .exmeet-tile').textContent).toContain('Priya Shah');
  });
  it('shows speaker highlight only for unmuted audio and displays hand queue position', () => {
    vi.spyOn(streamMeter,'useStreamLevel').mockReturnValue(.7);
    const rendered=mount(<VideoTile userName="Priya Shah" isHandRaised handPosition={2}/>);
    expect(document.querySelector('.exmeet-tile').getAttribute('data-speaking')).toBe('true');
    expect(document.querySelector('.exmeet-voice-meter').getAttribute('aria-label')).toBe('Priya Shah is speaking');
    expect(document.querySelector('.exmeet-hand-badge').textContent).toBe('Hand 2');
    rendered.rerender(<VideoTile userName="Priya Shah" isMuted/>);
    expect(document.querySelector('.exmeet-tile').hasAttribute('data-speaking')).toBe(false);expect(document.querySelector('.exmeet-voice-meter')).toBeNull();
  });
  it('marks incoming room messages unread and clears indicator when chat opens', async () => {
    mount(<MemoryRouter><VideoRoom roomCode="test-room" isHost preferences={prefs()} savePreferences={vi.fn()}/></MemoryRouter>);await settle();
    act(()=>sockets[0].trigger('chat:message-created',{roomCode:'another-room',senderId:'peer'}));expect(document.querySelector('.exmeet-unread-dot')).toBeNull();
    act(()=>sockets[0].trigger('chat:message-created',{roomCode:'test-room',senderId:'user-1'}));expect(document.querySelector('.exmeet-unread-dot')).toBeNull();
    act(()=>sockets[0].trigger('chat:message-created',{roomCode:'test-room',senderId:'peer'}));expect(document.querySelector('.exmeet-unread-dot')).toBeTruthy();
    clickTitle('Chat');expect(document.querySelector('.exmeet-unread-dot')).toBeNull();
  });
});

describe('media ownership and live device choices',()=>{
  it('preserves fast prejoin mute choices while camera and microphone permission is pending',async()=>{
    const pending=[];navigator.mediaDevices.getUserMedia.mockImplementation(constraints=>new Promise(resolve=>pending.push(()=>resolve(new Stream([new Track(constraints.video?'video':'audio')])))));
    renderHook(()=>useMediaDevices());let permission;
    act(()=>{permission=hook.requestPermission();});
    await act(async()=>{await hook.toggleAudio();await hook.toggleVideo();});
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    await act(async()=>{pending.forEach(resolve=>resolve());await permission;});
    expect(hook.isAudioEnabled).toBe(false);expect(hook.isVideoEnabled).toBe(false);
    expect(hook.stream.getTracks().every(track=>!track.enabled)).toBe(true);
  });
  it('exposes the active screen stream and clears it when sharing stops',async()=>{
    const screen=new Stream([new Track('video','Screen')]);navigator.mediaDevices.getDisplayMedia=vi.fn(async()=>screen);
    renderHook(()=>useWebRTC('test-room',{isHost:true}));await settle();
    await act(async()=>hook.toggleScreenShare());expect(hook.screenStream).toBe(screen);expect(hook.isScreenSharing).toBe(true);
    await act(async()=>hook.toggleScreenShare());expect(hook.screenStream).toBeNull();expect(hook.isScreenSharing).toBe(false);
    expect(screen.getVideoTracks()[0].readyState).toBe('ended');
  });
  it('retains usable audio when camera access fails',async()=>{
    navigator.mediaDevices.getUserMedia.mockImplementation(async c=>{if(c.video)throw new DOMException('Missing','NotFoundError');return new Stream([new Track('audio')]);});
    const result=await acquireMeetingMedia(); expect(result.stream.getAudioTracks()).toHaveLength(1);expect(result.error).toContain('Camera: device not found');
  });
  it('stops all owned tracks under StrictMode',async()=>{
    const rendered=renderHook(()=>useMediaDevices(),true);
    await act(async()=>{await hook.requestPermission();});
    const owned=hook.stream.getTracks();rendered.unmount();expect(owned.every(t=>t.readyState==='ended')).toBe(true);
  });
  it('stops tracks when permission resolves after navigation',async()=>{
    const pending = [], tracks = [];
    navigator.mediaDevices.getUserMedia.mockImplementation(c => new Promise(resolve => pending.push(() => { const track = new Track(c.video ? 'video' : 'audio'); tracks.push(track); resolve(new Stream([track])); })));
    const rendered=renderHook(()=>useMediaDevices(),true);
    let request;act(()=>{request=hook.requestPermission();});rendered.unmount();
    await act(async()=>{pending.forEach(resolve=>resolve());await request;});
    expect(tracks).toHaveLength(2);expect(tracks.every(t=>t.readyState==='ended')).toBe(true);
  });
  it('releases a disabled lobby stream without stopping transferred tracks',async()=>{
    const rendered=renderHook(()=>useMediaDevices());await act(async()=>{await hook.requestPermission();await hook.toggleAudio();await hook.toggleVideo();});
    let stream;act(()=>{stream=hook.releaseStream();});rendered.unmount();
    expect(stream.getTracks().every(t=>!t.enabled && t.readyState==='live')).toBe(true);
    stream.getTracks().forEach(t=>t.stop());
  });
  it('joins with disabled lobby tracks and authenticated signaling',async()=>{
    const stream=new Stream([new Track('audio'),new Track('video')]);stream.getTracks().forEach(t=>t.enabled=false);
    renderHook(()=>useWebRTC('test-room',{isHost:true,initialMedia:{stream,audioEnabled:false,videoEnabled:false,devices:{audio:'default'}}}));await settle();
    expect(hook.micMuted).toBe(true);expect(hook.cameraOff).toBe(true);expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(sockets[0].options.auth).toEqual({token:'test-session',roomCode:'test-room'});
    const join=sockets[0].events.find(e=>e.event==='join-room');expect(join.payload.muted).toBe(true);expect(join.payload.videoOff).toBe(true);expect(join.payload.isHost).toBeUndefined();expect(join.payload.userId).toBeUndefined();
  });
  it('switches actual microphone sender and preserves host mute',async()=>{
    renderHook(()=>useWebRTC('test-room',{isHost:true}));await settle();
    await act(async()=>sockets[0].trigger('existing-users',[{socketId:'peer',userName:'Peer'}]));
    act(()=>sockets[0].trigger('participant-mute-command',{muted:true,mutedByHost:true}));
    await act(async()=>hook.switchDevice('audio','mic-2'));
    expect(hook.localStream.getAudioTracks()[0].label).toBe('mic-2');expect(hook.localStream.getAudioTracks()[0].enabled).toBe(false);
    expect(pcs[0].getSenders().find(s=>s.track?.kind==='audio').track.label).toBe('mic-2');
  });
  it('sends processed video to peers and keeps raw camera private when effects are active',async()=>{
    renderHook(()=>useWebRTC('test-room',{isHost:true,videoEffects:true}));await settle();
    await act(async()=>sockets[0].trigger('existing-users',[{socketId:'peer',userName:'Peer'}]));
    expect(pcs[0].getSenders().find(s=>s.track?.kind==='video')).toBeUndefined();
    const processed=new Track('video','Canvas');await act(async()=>hook.setOutgoingVideoTrack(processed));
    expect(pcs[0].getSenders().find(s=>s.track?.kind==='video').track).toBe(processed);
    const later=[{socketId:'late',userName:'Late'}];await act(async()=>sockets[0].trigger('existing-users',later));
    expect(pcs[1].getSenders().find(s=>s.track?.kind==='video').track).toBe(processed);
  });
  it('continues signaling without media and exposes actionable errors',async()=>{
    navigator.mediaDevices.getUserMedia.mockRejectedValue(new DOMException('Denied','NotAllowedError'));
    renderHook(()=>useWebRTC('test-room'));await settle();
    expect(hook.localStream.getTracks()).toHaveLength(0);expect(hook.mediaError).toContain('permission denied');expect(sockets[0].events.some(e=>e.event==='request-join')).toBe(true);
  });
  it('removes raw video when effects activate and preserves canvas sender on device changes',async()=>{
    let effects=false;
    const rendered=renderHook(()=>useWebRTC('test-room',{isHost:true,videoEffects:effects}));await settle();
    await act(async()=>sockets[0].trigger('existing-users',[{socketId:'peer',userName:'Peer'}]));
    const sender=pcs[0].getSenders().find(s=>s.track?.kind==='video');expect(sender.track).toBe(hook.localStream.getVideoTracks()[0]);
    effects=true;rendered.rerender();await settle();expect(sender.track).toBeNull();
    const processed=new Track('video','Canvas');await act(async()=>hook.setOutgoingVideoTrack(processed));
    await act(async()=>hook.switchDevice('video','cam-2'));expect(sender.track).toBe(processed);expect(hook.localStream.getVideoTracks()[0].label).toBe('cam-2');
    effects=false;rendered.rerender();await settle();expect(sender.track).toBe(hook.localStream.getVideoTracks()[0]);
  });
});

describe('settings and controls',()=>{
  it('copies invitations through the selection fallback when clipboard permissions reject writes',async()=>{
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(new Error('Blocked'))}});
    const copy=vi.fn(()=>true);document.execCommand=copy;
    await copyMeetingText('https://meet.example/room/test-room');expect(copy).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();delete document.execCommand;delete navigator.clipboard;
  });
  it('keeps one side panel open when switching between chat and participants',async()=>{
    mount(<MemoryRouter><VideoRoom roomCode="test-room" isHost preferences={prefs()} savePreferences={vi.fn()}/></MemoryRouter>);await settle();
    clickTitle('Chat');expect(document.querySelector('[aria-label="Message everyone"]')).toBeTruthy();
    clickTitle('Participants');expect(document.querySelector('[aria-label="Message everyone"]')).toBeNull();expect(document.querySelector('[aria-label="Search participants"]')).toBeTruthy();
    clickTitle('Chat');expect(document.querySelector('[aria-label="Search participants"]')).toBeNull();expect(document.querySelectorAll('.exmeet-side-panel')).toHaveLength(1);
  });
  it('sends reactions through the existing room socket',async()=>{
    mount(<MemoryRouter><VideoRoom roomCode="test-room" isHost preferences={prefs()} savePreferences={vi.fn()}/></MemoryRouter>);await settle();
    clickTitle('Reactions');clickTitle('Send 👏 reaction');
    expect(sockets[0].events).toContainEqual({event:'reaction',payload:{roomCode:'test-room',emoji:'👏'}});
    expect(document.querySelector('.exmeet-reaction-menu')).toBeNull();
  });
  it('shares media through the new dialog and stops playback for the room',async()=>{
    mount(<MemoryRouter><VideoRoom roomCode="test-room" isHost preferences={prefs()} savePreferences={vi.fn()}/></MemoryRouter>);await settle();
    act(()=>sockets[0].trigger('your-role',{isHost:true}));
    clickTitle('More');clickText('Share video');expect(document.querySelector('[aria-label="Share video"]')).toBeTruthy();
    typeInput(document.querySelector('#meeting-media-url'),'https://example.com/clip.webm');
    act(()=>document.querySelector('[aria-label="Share video"] form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
    expect(sockets[0].events).toContainEqual({event:'share-media',payload:{roomCode:'test-room',url:'https://example.com/clip.webm',kind:'video'}});
    expect(document.querySelector('.exmeet-shared-media video').controls).toBe(true);
    clickText('Stop shared media');expect(sockets[0].events.at(-1)).toEqual({event:'share-media',payload:{roomCode:'test-room',url:null,kind:'video'}});
    expect(document.querySelector('.exmeet-shared-media')).toBeNull();
  });
  it('guests can open shared agenda from the new menu without gaining edit rights',async()=>{
    mount(<MemoryRouter><VideoRoom roomCode="test-room" preferences={prefs()} savePreferences={vi.fn()}/></MemoryRouter>);await settle();
    act(()=>sockets[0].trigger('admitted'));await settle();
    act(()=>sockets[0].trigger('agenda-state',{items:[{id:'shared',title:'Shared topic',done:false}]}));
    clickTitle('More');clickText('Meeting Agenda');
    expect(document.querySelector('.meeting-agenda').textContent).toContain('Shared topic');
    expect(document.querySelector('[aria-label="Complete topic: Shared topic"]').disabled).toBe(true);
    expect(document.querySelector('[aria-label="New agenda topic"]')).toBeNull();
  });
  it('shows the actual local screen stream and a working stop action while preserving self thumbnail',async()=>{
    const stream=new Stream([new Track('video','Screen')]),local=new Stream([new Track('video','Camera')]),stop=vi.fn();
    mount(<RoomStage roomCode="test-room" localStream={local} peers={{}} userName="Host" micMuted={false} cameraOff={false}
      filter="none" background="none" gridView isScreenSharing screenStream={stream} onStopScreen={stop}
      handQueue={[]} setSpotlightId={vi.fn()}/>);
    expect(document.querySelector('[data-screen-preview] video').srcObject).toBe(stream);
    expect(document.querySelector('.exmeet-filmstrip video').srcObject).toBe(local);
    clickText('Stop sharing');expect(stop).toHaveBeenCalledOnce();
  });
  it('restores spotlighted participant video after stream and camera changes',async()=>{
    const screen=new Stream([new Track('video','Screen')]);
    const props={roomCode:'test-room',localStream:null,userName:'Host',micMuted:true,cameraOff:true,filter:'none',background:'none',
      gridView:false,spotlightId:'remote',screenSharerId:'remote',handQueue:[],setSpotlightId:vi.fn()};
    const rendered=mount(<RoomStage {...props} peers={{remote:{userName:'Guest',stream:screen,videoOff:true}}}/>);
    expect(document.querySelector('.exmeet-stage-grid > .exmeet-tile video').srcObject).toBe(screen);
    expect(document.querySelector('.exmeet-stage-grid > .exmeet-tile video').style.objectFit).toBe('contain');
    rendered.rerender(<RoomStage {...props} screenSharerId={null} peers={{remote:{userName:'Guest',stream:screen,videoOff:true}}}/>);
    expect(document.querySelector('.exmeet-stage-grid > .exmeet-tile video')).toBeNull();
  });
  it('previews the existing stream and supports Escape with focus restoration',async()=>{
    const onClose=vi.fn(), onSave=vi.fn();const trigger=document.createElement('button');document.body.appendChild(trigger);trigger.focus();
    const stream=new Stream([new Track('video')]);const rendered=mount(<MeetingSettings initialTab="backgrounds" preferences={prefs()} onClose={onClose} onSave={onSave} stream={stream} audioEnabled={false} videoEnabled devices={{cameras:[],microphones:[],speakers:[]}} selectedDevices={{}} switchDevice={vi.fn()}/>);
    expect(document.querySelector('video').srcObject).toBe(stream);expect(document.querySelector('[role="dialog"]')).toBeTruthy();
    vi.spyOn(HTMLElement.prototype,'getClientRects').mockReturnValue([{width:48,height:48}]);
    const first=document.querySelector('[aria-label="Close settings"]'),last=[...document.querySelectorAll('button')].find(b=>b.textContent==='Apply settings');
    first.focus();act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true})));expect(document.activeElement).toBe(last);
    act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true})));expect(document.activeElement).toBe(first);
    act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(onClose).toHaveBeenCalledOnce();rendered.unmount();expect(document.activeElement).toBe(trigger);trigger.remove();
  });
  it('applies theme preferences; Cancel commits nothing',async()=>{
    const onSave=vi.fn(), onClose=vi.fn(), switchDevice=vi.fn(async()=>{});
    const rendered=mount(<MeetingSettings initialTab="general" preferences={prefs()} onClose={onClose} onSave={onSave} stream={null} devices={{cameras:[],microphones:[],speakers:[]}} selectedDevices={{audio:'default'}} switchDevice={switchDevice}/>);
    const select=document.querySelector('select');act(()=>{select.value='light';select.dispatchEvent(new Event('change',{bubbles:true}));});clickText('Cancel');expect(onSave).not.toHaveBeenCalled();rendered.unmount();
    mount(<MeetingSettings initialTab="general" preferences={prefs()} onClose={onClose} onSave={onSave} stream={null} devices={{cameras:[],microphones:[],speakers:[]}} selectedDevices={{audio:'default'}} switchDevice={switchDevice}/>);
    const newSelect=document.querySelector('select');act(()=>{newSelect.value='light';newSelect.dispatchEvent(new Event('change',{bubbles:true}));});await act(async()=>clickText('Apply settings'));expect(onSave).toHaveBeenCalledWith(expect.objectContaining({theme:'light'}));
  });
  it('applies selected microphone to the real media owner',async()=>{
    const onSave=vi.fn(),switchDevice=vi.fn(async()=>{});
    mount(<MeetingSettings preferences={prefs()} onClose={vi.fn()} onSave={onSave} stream={null} audioEnabled={false} devices={{cameras:[],microphones:[{deviceId:'mic-2',label:'Second mic'}],speakers:[]}} selectedDevices={{audio:'default',video:''}} switchDevice={switchDevice}/>);
    const select=document.querySelector('select');act(()=>{select.value='mic-2';select.dispatchEvent(new Event('change',{bubbles:true}));});await act(async()=>clickText('Apply settings'));
    expect(switchDevice).toHaveBeenCalledExactlyOnceWith('audio','mic-2');expect(onSave).toHaveBeenCalledWith(expect.objectContaining({devices:{audio:'mic-2',video:''}}));
  });
  it('persists preferences when the meeting is reopened',async()=>{
    const rendered=renderHook(()=>useMeetingPreferences());act(()=>hook[1]({...prefs(),theme:'light',outputDevice:'speaker-2'}));rendered.unmount();
    renderHook(()=>useMeetingPreferences());expect(hook[0].theme).toBe('light');expect(hook[0].outputDevice).toBe('speaker-2');
  });
  it('M/V shortcuts work without hijacking typed messages; toolbar stays visible',async()=>{
    mount(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><VideoRoom roomCode="test-room" isHost preferences={prefs()} savePreferences={vi.fn()}/></MemoryRouter>);await settle();
    act(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'m',bubbles:true})));await settle();
    expect(document.querySelector('[title="Unmute microphone"]')).toBeTruthy();
    act(()=>document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'v',bubbles:true})));await settle();expect(document.querySelector('[title="Start camera"]')).toBeTruthy();
    const input=document.createElement('input');document.body.appendChild(input);act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'m',bubbles:true})));await settle();expect(document.querySelector('[title="Unmute microphone"]')).toBeTruthy();input.remove();
    expect(document.querySelector('[role="toolbar"]')).toBeTruthy();expect(document.querySelector('.toolbar-wrap.hidden')).toBeNull();
  });
  it('guest invitations open a working, keyboard-accessible dialog',async()=>{
    mount(<MemoryRouter><VideoRoom roomCode="test-room" preferences={prefs()} savePreferences={vi.fn()}/></MemoryRouter>);await settle();
    act(()=>sockets[0].trigger('admitted'));await settle();clickTitle('More');clickText('Invite people');
    expect(document.querySelector('[role="dialog"]').textContent).toContain('Invite more people');
    expect(document.querySelector('[role="dialog"]').textContent).toContain('Copy meeting link');
    act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it('participant search filters real room members',async()=>{
    mount(<MemoryRouter><VideoRoom roomCode="test-room" isHost preferences={prefs()} savePreferences={vi.fn()}/></MemoryRouter>);await settle();
    act(()=>sockets[0].trigger('user-joined',{socketId:'alice',userName:'Alice',userId:'alice'}));clickTitle('Participants');
    expect(document.querySelectorAll('[data-room-participant]')).toHaveLength(2);
    typeInput(document.querySelector('[aria-label="Search participants"]'),'alice');expect(document.querySelectorAll('[data-room-participant]')).toHaveLength(1);expect(document.querySelector('[data-room-participant]').textContent).toContain('Alice');
    typeInput(document.querySelector('[aria-label="Search participants"]'),'missing');expect(document.querySelectorAll('[data-room-participant]')).toHaveLength(0);
  });
  it('hiding self view does not disable the camera',async()=>{
    mount(<MemoryRouter><VideoRoom roomCode="test-room" isHost preferences={prefs()} savePreferences={vi.fn()}/></MemoryRouter>);await settle();
    clickTitle('More');clickText('Performance settings');expect(document.body.textContent).toContain('Self view hidden');
    expect(captures.flatMap(s=>s.getVideoTracks()).every(t=>t.enabled && t.readyState==='live')).toBe(true);
    clickTitle('More');clickText('Performance settings');expect(document.body.textContent).not.toContain('Self view hidden');
  });
  it('agenda edits reach the server and server updates reach the room',async()=>{
    mount(<MemoryRouter><VideoRoom roomCode="test-room" isHost preferences={prefs()} savePreferences={vi.fn()}/></MemoryRouter>);await settle();
    act(()=>{sockets[0].trigger('your-role',{isHost:true});sockets[0].trigger('agenda-state',{items:[{id:'topic-1',title:'Release plan',done:false}]});});
    clickTitle('More');clickText('Meeting Agenda');expect(document.querySelector('.meeting-agenda').textContent).toContain('Release plan');
    act(()=>document.querySelector('[aria-label="Complete topic: Release plan"]').click());expect(sockets[0].events.at(-1)).toEqual({event:'toggle-agenda-item',payload:{roomCode:'test-room',id:'topic-1'}});
    act(()=>sockets[0].trigger('agenda-updated',[{id:'topic-1',title:'Release plan',done:true}]));expect(document.querySelector('[aria-label="Mark incomplete: Release plan"]')).toBeTruthy();
    typeInput(document.querySelector('[aria-label="New agenda topic"]'),'Next steps');clickText('Add');expect(sockets[0].events.at(-1)).toEqual({event:'add-agenda-item',payload:{roomCode:'test-room',title:'Next steps'}});
  });
  it('chat failures keep the unsent message and provide retry feedback',async()=>{
    mount(<VerifiedChat roomCode="test-room" embedded/>);await settle();
    typeInput(document.querySelector('[aria-label="Message everyone"]'),'Keep this draft');vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Offline'));
    await act(async()=>document.querySelector('[aria-label="Send message"]').click());await settle();
    expect(document.querySelector('[aria-label="Message everyone"]').value).toBe('Keep this draft');expect(document.querySelector('[role="alert"]').textContent).toContain('Message not sent');
    expect(document.querySelector('[aria-label="Retry chat"]')).toBeTruthy();
  });
  it('microphone meter measures samples and releases its audio context',async()=>{
    vi.useFakeTimers();const close=vi.fn(async()=>{}),disconnect=vi.fn();
    vi.stubGlobal('AudioContext',class {createMediaStreamSource(){return{connect(){},disconnect};}createAnalyser(){return{fftSize:512,getByteTimeDomainData(values){values.fill(140);}};}resume(){return Promise.resolve();}close(){return close();}});
    const stream=new Stream([new Track('audio')]);const rendered=renderHook(()=>useStreamLevel(stream));
    act(()=>vi.advanceTimersByTime(100));expect(hook).toBeCloseTo(0.46875);rendered.unmount();expect(disconnect).toHaveBeenCalled();expect(close).toHaveBeenCalled();vi.useRealTimers();
  });
});


describe('complete reference template integration',()=>{
  async function room(host=true){mount(<ReferenceVideoRoom roomCode="test-room" isHost={host} preferences={prefs()} savePreferences={vi.fn()}/>);await settle();act(()=>{sockets[0].trigger('your-role',{isHost:host});if(!host)sockets[0].trigger('admitted');sockets[0].trigger('roster-state',{members:[{socketId:'self',userName:'Audit User',isHost:host}]});});await settle();}
  it('renders every original More action and all seven settings tabs',async()=>{
    await room();clickTitle('More options');
    for(const label of ['Record','Speaker view','Captions','Whiteboard','Invite people','Full screen','Agenda','Polls','File sharing','Security options','Breakout rooms','Share video','Share audio','Noise suppression','Background','Performance','Participant stats','Settings','Shortcuts','Leave feedback'])expect(document.body.textContent).toContain(label);
    clickText('Settings');for(const tab of ['Audio','Video','Backgrounds','Notifications','Profile','Shortcuts','Appearance']){clickText(tab);expect(document.querySelector('[role=dialog]')).toBeTruthy();}
  });
  it('attaches actual video stream and prevents host-muted microphone actions',async()=>{
    await room();expect(document.querySelector('[data-tile=me] video').srcObject).toBeInstanceOf(Stream);
    act(()=>sockets[0].trigger('participant-mute-command',{muted:true,mutedByHost:true}));
    expect(document.querySelector('[title="Microphone muted by host"]').disabled).toBe(true);
  });
  it('guests can access shared polls and files without a poll composer or host tools',async()=>{
    await room(false);clickTitle('More options');expect(document.body.textContent).toContain('Polls');expect(document.body.textContent).toContain('File sharing');expect(document.body.textContent).not.toContain('Security options');clickText('Polls');expect(document.querySelector('input[placeholder="Ask a question"]')).toBeNull();
  });
  it('policy changes remove guest chat composer and profile rename reaches server',async()=>{
    await room(false);act(()=>sockets[0].trigger('meeting-policy',{waitingRoom:true,allowChat:false,allowShare:false}));clickTitle('Chat (C)');expect(document.querySelector('input[placeholder="Send a message to everyone"]')).toBeNull();
    clickTitle('More options');clickText('Settings');clickText('Profile');typeInput(document.querySelector('[role=dialog] input'),'New name');await act(async()=>new Promise(r=>setTimeout(r,600)));expect(sockets[0].events).toContainEqual({event:'rename-participant',payload:{roomCode:'test-room',name:'New name'}});
  });
});


describe('noise suppression microphone state',()=>{
  it('keeps raw and filtered outgoing tracks muted while the private source clone stays usable',async()=>{
    const inputs=[];
    class Audio {
      createMediaStreamSource(stream){inputs.push(stream);return {connect:node=>node};}
      createBiquadFilter(){return {frequency:{value:0},connect:node=>node};}
      createMediaStreamDestination(){return {stream:new Stream([new Track('audio','filtered')])};}
      resume(){return Promise.resolve();}
      close(){return Promise.resolve();}
    }
    vi.stubGlobal('AudioContext',Audio);
    renderHook(()=>useWebRTC('test-room',{isHost:true}));await settle();
    const raw=hook.localStream.getAudioTracks()[0];
    await act(async()=>hook.toggleMic());expect(raw.enabled).toBe(false);
    act(()=>hook.toggleNoiseSuppression());
    expect(hook.noiseSuppressed).toBe(true);expect(hook.micMuted).toBe(true);
    expect(hook.localStream.getAudioTracks()[0].enabled).toBe(false);
    expect(raw.enabled).toBe(false);expect(inputs[0].getAudioTracks()[0]).not.toBe(raw);
    expect(inputs[0].getAudioTracks()[0].enabled).toBe(true);
    act(()=>hook.toggleNoiseSuppression());
    expect(hook.noiseSuppressed).toBe(false);expect(hook.localStream.getAudioTracks()[0]).toBe(raw);
    expect(raw.enabled).toBe(false);expect(inputs[0].getAudioTracks()[0].readyState).toBe('ended');
  });
});
