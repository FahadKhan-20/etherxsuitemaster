import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { useMediaDevices } from '../src/hooks/useMediaDevices';
import { useWebRTC } from '../src/hooks/useWebRTC';
import { acquireMeetingMedia } from '../src/utils/meetingMedia';
import { DEFAULT_MEETING_PREFERENCES, useMeetingPreferences } from '../src/hooks/useMeetingPreferences';
import MeetingSettings from '../src/components/room/MeetingSettings';
import CaptionsOverlay from '../src/components/room/CaptionsOverlay';
import ReferenceVideoRoom from '../src/components/room/ReferenceVideoRoom';
import ProfileAvatar from '../src/components/ui/ProfileAvatar';
import apiClient from '../src/utils/apiClient';
import { useStreamLevel } from '../src/hooks/useStreamLevel';
import { copyMeetingText } from '../src/utils/meetingClipboard';
import { useMeetingRecording } from '../src/hooks/useMeetingRecording';

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
  constructor(config) { this.config = config; this.transceivers = []; this.signalingState = 'stable'; this.connectionState = 'new'; pcs.push(this); }
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

describe('media ownership and live device choices',()=>{
  it('preserves fast prejoin mute choices while camera and microphone permission is pending',async()=>{
    const pending=[],tracks=[];
    navigator.mediaDevices.getUserMedia.mockImplementation(constraints=>new Promise(resolve=>{
      pending.push(()=>{
        const track=new Track(constraints.video?'video':'audio');
        tracks.push(track);resolve(new Stream([track]));
      });
    }));
    renderHook(()=>useMediaDevices());let permission;
    act(()=>{permission=hook.requestPermission();});
    await act(async()=>{await hook.toggleAudio();await hook.toggleVideo();});
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    await act(async()=>{pending.forEach(resolve=>resolve());await permission;});
    expect(hook.isAudioEnabled).toBe(false);expect(hook.isVideoEnabled).toBe(false);
    expect(hook.stream.getTracks().every(track=>!track.enabled)).toBe(true);
    expect(hook.stream.getVideoTracks()).toHaveLength(0);
    expect(tracks.find(track=>track.kind==='video').readyState).toBe('ended');
  });
  it('releases the lobby camera and defers device capture until camera is enabled again',async()=>{
    renderHook(()=>useMediaDevices());await act(async()=>hook.requestPermission());
    const camera=hook.stream.getVideoTracks()[0],mic=hook.stream.getAudioTracks()[0];
    await act(async()=>hook.toggleVideo());
    expect(camera.readyState).toBe('ended');expect(hook.stream.getVideoTracks()).toHaveLength(0);
    expect(mic.readyState).toBe('live');expect(hook.isVideoEnabled).toBe(false);
    const calls=navigator.mediaDevices.getUserMedia.mock.calls.length;
    await act(async()=>hook.switchDevice('video','cam-2'));
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(calls);
    await act(async()=>hook.toggleVideo());
    expect(hook.isVideoEnabled).toBe(true);expect(hook.stream.getVideoTracks()[0].label).toBe('cam-2');
  });
  it('stops a lobby camera capture that resolves after camera is turned off',async()=>{
    renderHook(()=>useMediaDevices());await act(async()=>hook.requestPermission());await act(async()=>hook.toggleVideo());
    const camera=new Track('video');let resolve;
    navigator.mediaDevices.getUserMedia.mockImplementation(()=>new Promise(done=>{resolve=done;}));
    let enable;act(()=>{enable=hook.toggleVideo();});await act(async()=>hook.toggleVideo());
    await act(async()=>{resolve(new Stream([camera]));await enable;});
    expect(camera.readyState).toBe('ended');expect(hook.isVideoEnabled).toBe(false);expect(hook.stream.getVideoTracks()).toHaveLength(0);
  });
  it('does not restore a lobby camera when a device switch resolves after camera off',async()=>{
    renderHook(()=>useMediaDevices());await act(async()=>hook.requestPermission());
    const camera=new Track('video','cam-2');let resolve;
    navigator.mediaDevices.getUserMedia.mockImplementation(()=>new Promise(done=>{resolve=done;}));
    let change;act(()=>{change=hook.switchDevice('video','cam-2');});await act(async()=>hook.toggleVideo());
    await act(async()=>{resolve(new Stream([camera]));await change;});
    expect(camera.readyState).toBe('ended');expect(hook.isVideoEnabled).toBe(false);expect(hook.stream.getVideoTracks()).toHaveLength(0);
  });
  it('keeps the latest lobby camera enabled when device selection changes during capture',async()=>{
    renderHook(()=>useMediaDevices());await act(async()=>hook.requestPermission());await act(async()=>hook.toggleVideo());
    const pending=[];navigator.mediaDevices.getUserMedia.mockImplementation(()=>new Promise(resolve=>pending.push(resolve)));
    let enable,change;act(()=>{enable=hook.toggleVideo();});act(()=>{change=hook.switchDevice('video','cam-2');});
    const camera=new Track('video','cam-2'),stale=new Track('video');
    await act(async()=>{pending[1](new Stream([camera]));await change;pending[0](new Stream([stale]));await enable;});
    expect(camera.enabled).toBe(true);expect(hook.stream.getVideoTracks()).toEqual([camera]);expect(stale.readyState).toBe('ended');
    expect(hook.isVideoEnabled).toBe(true);
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
    expect(stream.getAudioTracks()).toHaveLength(1);expect(stream.getVideoTracks()).toHaveLength(0);
    stream.getTracks().forEach(t=>t.stop());
  });
  it('joins with disabled lobby tracks and authenticated signaling',async()=>{
    const stream=new Stream([new Track('audio'),new Track('video')]);stream.getTracks().forEach(t=>t.enabled=false);
    const camera=stream.getVideoTracks()[0];
    renderHook(()=>useWebRTC('test-room',{isHost:true,initialMedia:{stream,audioEnabled:false,videoEnabled:false,devices:{audio:'default'}}}));await settle();
    expect(hook.micMuted).toBe(true);expect(hook.cameraOff).toBe(true);expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(camera.readyState).toBe('ended');expect(hook.localStream.getVideoTracks()).toHaveLength(0);
    expect(sockets[0].options.auth).toEqual({token:'test-session',roomCode:'test-room'});
    const join=sockets[0].events.find(e=>e.event==='join-room');expect(join.payload.muted).toBe(true);expect(join.payload.videoOff).toBe(true);expect(join.payload.isHost).toBeUndefined();expect(join.payload.userId).toBeUndefined();
  });
  it('stops the room camera, clears peer video, and keeps device changes private while off',async()=>{
    renderHook(()=>useWebRTC('test-room',{isHost:true}));await settle();
    await act(async()=>sockets[0].trigger('existing-users',[{socketId:'peer',userName:'Peer'}]));
    const camera=hook.localStream.getVideoTracks()[0],mic=hook.localStream.getAudioTracks()[0];
    const sender=pcs[0].getSenders().find(s=>s.track?.kind==='video');
    await act(async()=>hook.toggleCamera());
    expect(camera.readyState).toBe('ended');expect(sender.track).toBeNull();expect(mic.readyState).toBe('live');
    const calls=navigator.mediaDevices.getUserMedia.mock.calls.length;
    await act(async()=>hook.switchDevice('video','cam-2'));
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(calls);expect(hook.cameraOff).toBe(true);
    await act(async()=>hook.toggleCamera());
    expect(hook.cameraOff).toBe(false);expect(sender.track).toBe(hook.localStream.getVideoTracks()[0]);expect(sender.track.label).toBe('cam-2');
  });
  it('stops room camera captures that resolve after camera off',async()=>{
    renderHook(()=>useWebRTC('test-room',{isHost:true}));await settle();await act(async()=>hook.toggleCamera());
    const camera=new Track('video');let resolve;
    navigator.mediaDevices.getUserMedia.mockImplementation(()=>new Promise(done=>{resolve=done;}));
    let enable;act(()=>{enable=hook.toggleCamera();});await act(async()=>hook.toggleCamera());
    await act(async()=>{resolve(new Stream([camera]));await enable;});
    expect(camera.readyState).toBe('ended');expect(hook.cameraOff).toBe(true);expect(hook.localStream.getVideoTracks()).toHaveLength(0);
  });
  it('stops room camera switches that resolve after camera off',async()=>{
    renderHook(()=>useWebRTC('test-room',{isHost:true}));await settle();
    const camera=new Track('video','cam-2');let resolve;
    navigator.mediaDevices.getUserMedia.mockImplementation(()=>new Promise(done=>{resolve=done;}));
    let change;act(()=>{change=hook.switchDevice('video','cam-2');});await act(async()=>hook.toggleCamera());
    await act(async()=>{resolve(new Stream([camera]));await change;});
    expect(camera.readyState).toBe('ended');expect(hook.cameraOff).toBe(true);expect(hook.localStream.getVideoTracks()).toHaveLength(0);
  });
  it('keeps screen sharing live and ignores late processed camera output while camera is off',async()=>{
    const screen=new Stream([new Track('video','Screen')]);navigator.mediaDevices.getDisplayMedia=vi.fn(async()=>screen);
    renderHook(()=>useWebRTC('test-room',{isHost:true,videoEffects:true}));await settle();
    await act(async()=>sockets[0].trigger('existing-users',[{socketId:'peer',userName:'Peer'}]));
    await act(async()=>hook.toggleScreenShare());await act(async()=>hook.toggleCamera());
    const sender=pcs[0].getSenders().find(s=>s.track?.kind==='video');
    expect(sender.track).toBe(screen.getVideoTracks()[0]);expect(sender.track.readyState).toBe('live');
    await act(async()=>hook.setOutgoingVideoTrack(new Track('video','Canvas')));
    await act(async()=>hook.toggleScreenShare());expect(sender.track).toBeNull();expect(hook.cameraOff).toBe(true);
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
  it('shows Google account photos in camera-off tiles, the header and participant list',async()=>{
    const localPhoto='https://lh3.googleusercontent.com/local-photo',peerPhoto='https://lh3.googleusercontent.com/peer-photo';
    localStorage.setItem('nexmeet_user',JSON.stringify({id:'user-1',name:'Audit User',avatar:localPhoto}));
    await room();await act(async()=>document.querySelector('[title="Turn camera off (V)"]').click());
    await act(async()=>sockets[0].trigger('existing-users',[{socketId:'peer',userName:'Peer User',avatar:peerPhoto,videoOff:true}]));
    act(()=>sockets[0].trigger('user-joined',{socketId:'newcomer',userName:'New User',avatar:peerPhoto,videoOff:true}));
    act(()=>sockets[0].trigger('roster-state',{members:[{socketId:'self',userName:'Audit User',isHost:true,avatar:localPhoto},{socketId:'peer',userName:'Peer User',avatar:peerPhoto},{socketId:'newcomer',userName:'New User',avatar:peerPhoto}]}));
    expect(document.querySelector('[data-tile=me] img').src).toBe(localPhoto);
    expect(document.querySelector('[data-tile=peer] img').src).toBe(peerPhoto);
    expect(document.querySelector('[data-tile=newcomer] img').src).toBe(peerPhoto);
    expect(document.querySelector('header img[alt="Audit User\'s profile photo"]').src).toBe(localPhoto);
    clickTitle('Participants');
    expect(document.querySelector('aside img[alt="Peer User\'s profile photo"]').src).toBe(peerPhoto);
    act(()=>document.querySelector('[data-tile=peer] img').dispatchEvent(new Event('error')));
    expect(document.querySelector('[data-tile=peer] img')).toBeNull();expect(document.querySelector('[data-tile=peer]').textContent).toContain('PU');
    await act(async()=>document.querySelector('[title="Turn camera on (V)"]').click());
    expect(document.querySelector('[data-tile=me] img')).toBeNull();expect(document.querySelector('[data-tile=me] video').srcObject.getVideoTracks()[0].readyState).toBe('live');
  });
  it('guests can launch polls and share files without host tools',async()=>{
    await room(false);clickTitle('More options');expect(document.body.textContent).toContain('Polls');expect(document.body.textContent).toContain('File sharing');expect(document.body.textContent).not.toContain('Security options');clickText('Polls');expect(document.querySelector('input[placeholder="Ask a question"]')).not.toBeNull();
  });
  it('policy changes remove guest chat composer and profile rename reaches server',async()=>{
    await room(false);act(()=>sockets[0].trigger('meeting-policy',{waitingRoom:true,allowChat:false,allowShare:false}));clickTitle('Chat (C)');expect(document.querySelector('input[placeholder="Send a message to everyone"]')).toBeNull();
    clickTitle('More options');clickText('Settings');clickText('Profile');typeInput(document.querySelector('[role=dialog] input'),'New name');await act(async()=>new Promise(r=>setTimeout(r,600)));expect(sockets[0].events).toContainEqual({event:'rename-participant',payload:{roomCode:'test-room',name:'New name'}});
  });
});

describe('profile photo fallback',()=>{
  it('uses initials for missing photos and recovers when a failed photo URL changes',()=>{
    const rendered=mount(<ProfileAvatar name="Test User" initials="TU"/>);
    expect(rendered.container.textContent).toBe('TU');expect(rendered.container.querySelector('img')).toBeNull();
    rendered.rerender(<ProfileAvatar name="Test User" initials="TU" src="https://lh3.googleusercontent.com/old-photo"/>);
    act(()=>rendered.container.querySelector('img').dispatchEvent(new Event('error')));
    expect(rendered.container.textContent).toBe('TU');expect(rendered.container.querySelector('img')).toBeNull();
    rendered.rerender(<ProfileAvatar name="Test User" initials="TU" src="https://lh3.googleusercontent.com/new-photo"/>);
    expect(rendered.container.querySelector('img').src).toBe('https://lh3.googleusercontent.com/new-photo');
    expect(rendered.container.querySelector('img').style.objectFit).toBe('cover');
    expect(rendered.container.querySelector('img').getAttribute('referrerpolicy')).toBe('no-referrer');
  });
});


describe('noise suppression microphone state',()=>{
  it('uses the browser noise suppression on a re-captured mic and keeps the mute state',async()=>{
    renderHook(()=>useWebRTC('test-room',{isHost:true}));await settle();
    expect(hook.noiseSuppressed).toBe(true);
    const first=navigator.mediaDevices.getUserMedia.mock.calls.find(([c])=>c.audio)[0];
    expect(first.audio).toMatchObject({noiseSuppression:true,echoCancellation:true});
    const raw=hook.localStream.getAudioTracks()[0];
    await act(async()=>hook.toggleMic());
    await act(async()=>hook.toggleNoiseSuppression());
    expect(hook.noiseSuppressed).toBe(false);
    expect(navigator.mediaDevices.getUserMedia.mock.calls.at(-1)[0].audio).toMatchObject({noiseSuppression:false});
    const next=hook.localStream.getAudioTracks()[0];
    expect(next).not.toBe(raw);expect(raw.readyState).toBe('ended');expect(next.enabled).toBe(false);expect(hook.micMuted).toBe(true);
    await act(async()=>hook.toggleNoiseSuppression());
    expect(hook.noiseSuppressed).toBe(true);
    expect(navigator.mediaDevices.getUserMedia.mock.calls.at(-1)[0].audio).toMatchObject({noiseSuppression:true});
  });
});

describe('captions on browsers without speech recognition',()=>{
  const fakeSocket=()=>{const handlers=new Map();return {events:[],on(e,h){handlers.set(e,h);},off(e){handlers.delete(e);},emit(event,payload){this.events.push({event,payload});},trigger(e,p){handlers.get(e)?.(p);}};};
  it('keeps a notice, warns the speaker and tells the room this speaker is not captioned',async()=>{
    vi.stubGlobal('SpeechRecognition',undefined);vi.stubGlobal('webkitSpeechRecognition',undefined);
    const socket=fakeSocket(),onUnavailable=vi.fn();
    mount(<CaptionsOverlay socket={socket} roomCode="test-room" show transcribe onUnavailable={onUnavailable}/>);await settle();
    expect(onUnavailable).toHaveBeenCalledOnce();
    expect(socket.events.some(e=>e.event==='caption-unavailable'&&e.payload.roomCode==='test-room')).toBe(true);
    await act(async()=>{await new Promise(r=>setTimeout(r,4500));});
    expect(document.body.textContent).toContain("Your browser can't caption your speech");
  });
  it('lists room members who cannot be captioned until they leave',async()=>{
    const socket=fakeSocket();
    mount(<CaptionsOverlay socket={socket} roomCode="test-room" show transcribe={false}/>);await settle();
    act(()=>socket.trigger('caption-unavailable',{socketId:'peer',userName:'Priya Shah'}));
    expect(document.body.textContent).toContain('Not captioned (browser unsupported): Priya Shah');
    act(()=>socket.trigger('user-left',{socketId:'peer'}));
    expect(document.body.textContent).not.toContain('Priya Shah');
  });
});

describe('TURN relay configuration',()=>{
  it('builds peer connections with the ICE servers the backend provides',async()=>{
    const relay={urls:['turn:turn.example.com:3478'],username:'meet',credential:'secret'};
    vi.mocked(apiClient.get).mockImplementation(async url=>url==='/api/rooms/ice-servers'?{data:{iceServers:[relay]}}:{data:{data:[]}});
    renderHook(()=>useWebRTC('test-room',{isHost:true}));await settle();
    await act(async()=>sockets[0].trigger('existing-users',[{socketId:'peer',userName:'Peer'}]));
    expect(pcs[0].config.iceServers).toEqual([relay]);
  });
});

describe('full meetings',()=>{
  it('shows a full-meeting screen instead of the room when the server rejects the join',async()=>{
    mount(<MemoryRouter><ReferenceVideoRoom roomCode="test-room" isHost preferences={prefs()} savePreferences={vi.fn()}/></MemoryRouter>);await settle();
    await act(async()=>sockets[0].trigger('room-full',{max:50}));
    expect(document.body.textContent).toContain('Meeting is full');
    expect(document.body.textContent).toContain('This meeting is full (50 people max)');
  });
});

describe('meeting reminder timing',()=>{
  it('rolls repeating meetings forward and drops finished one-off meetings',async()=>{
    const { nextStart } = await import('../src/components/layout/MeetingReminders');
    const start = Date.UTC(2026, 9, 1, 10, 0);
    const now = Date.UTC(2026, 9, 9, 9, 0);
    expect(nextStart({ startAt: new Date(start).toISOString(), duration: 30, recurring: 'daily' }, now)).toBe(Date.UTC(2026, 9, 9, 10, 0));
    expect(nextStart({ startAt: new Date(start).toISOString(), duration: 30, recurring: 'weekly' }, now)).toBe(Date.UTC(2026, 9, 15, 10, 0));
    expect(nextStart({ startAt: new Date(start).toISOString(), duration: 30, recurring: 'none' }, now)).toBe(null);
    expect(nextStart({ startAt: new Date(now + 600000).toISOString(), duration: 30, recurring: 'none' }, now)).toBe(now + 600000);
  });
});

describe('reminders across daylight saving',()=>{
  it('keeps the same local start time after a clock change',async()=>{
    const { nextStart } = await import('../src/components/layout/MeetingReminders');
    const before = new Date(2026, 2, 1, 10, 0); // local 10:00, before most DST switches
    const after = new Date(2026, 3, 15, 8, 0).getTime();
    const next = new Date(nextStart({ startAt: before.toISOString(), duration: 30, recurring: 'daily' }, after));
    expect([next.getHours(), next.getMinutes(), next.getDate()]).toEqual([10, 0, 15]);
  });
});

describe('malformed reactions',()=>{
  it('ignores reactions that are not short text instead of crashing the room',async()=>{
    renderHook(()=>useWebRTC('test-room',{isHost:true}));await settle();
    act(()=>{for(const emoji of [{$$typeof:Symbol.for('react.element')},['x'],'x'.repeat(40),5])sockets[0].trigger('reaction',{emoji,socketId:'peer',userName:'Peer'});sockets[0].trigger('reaction',{emoji:'👏',socketId:'peer',userName:'Peer'});});
    expect(hook.reactions.map(r=>r.emoji)).toEqual(['👏']);
  });
});

describe('recording status across a quick stop and restart',()=>{
  it('keeps REC accurate: no restart while saving, and the old save never hides a new recording',async()=>{
    const recorders=[];
    class FakeRecorder{constructor(){this.state='inactive';recorders.push(this);}static isTypeSupported(){return true;}start(){this.state='recording';}stop(){this.state='inactive';setTimeout(()=>{this.ondataavailable?.({data:new Blob(['x'])});this.onstop?.();},0);}}
    vi.stubGlobal('MediaRecorder',FakeRecorder);
    vi.stubGlobal('AudioContext',class{createMediaStreamDestination(){return{stream:new Stream([new Track('audio')])};}createMediaStreamSource(){return{connect(){},disconnect(){}};}close(){return Promise.resolve();}});
    vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
    vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({fillRect(){},drawImage(){},fillText(){}});
    HTMLCanvasElement.prototype.captureStream=()=>new Stream([new Track('video')]);
    let finishUpload;vi.mocked(apiClient.post).mockImplementation(()=>new Promise(r=>{finishUpload=()=>r({data:{}});}));
    const handlers=new Map(),socket={on:(e,h)=>handlers.set(e,h),off:()=>{},emit:(e,_p,ack)=>{if(e==='recording-start'){ack?.({ok:true});handlers.get('recording-state')?.({state:'recording'});}if(e==='recording-stop'){ack?.({ok:true});handlers.get('recording-state')?.({state:'idle'});}}};
    const onError=vi.fn();
    renderHook(()=>useMeetingRecording({roomCode:'test-room',isHost:true,localStream:null,screenStream:null,peers:{},userName:'Host',socket,socketReady:true,onError}));
    await act(async()=>hook.startRecording());expect(hook.recordingState).toBe('recording');
    await act(async()=>{hook.stopRecording();await new Promise(r=>setTimeout(r,5));});
    expect(hook.isRecording).toBe(true);expect(hook.recordingState).toBe('stopping'); // still saving: server 'idle' must not hide it
    await act(async()=>hook.startRecording());
    expect(recorders.length).toBe(1);expect(onError).toHaveBeenCalledWith(expect.stringMatching(/saving/i));
    await act(async()=>{finishUpload();await new Promise(r=>setTimeout(r,5));});
    expect(hook.recordingState).toBe('completed');
    vi.useFakeTimers();
    await act(async()=>hook.startRecording());expect(hook.recordingState).toBe('recording');expect(recorders.length).toBe(2);
    await act(async()=>{vi.advanceTimersByTime(3000);});
    vi.useRealTimers();
    expect(hook.recordingState).toBe('recording');expect(hook.isRecording).toBe(true);
  });
});

describe('YouTube links',()=>{
  it('finds the video id in every common link shape and rejects other pages',async()=>{
    const { youtubeId } = await import('../src/utils/youtube');
    for(const url of ['https://youtu.be/-S_9Kuy8faU?si=H5oYf-6uuTAvndGI','https://www.youtube.com/watch?v=-S_9Kuy8faU&t=42','https://m.youtube.com/watch?v=-S_9Kuy8faU','https://www.youtube.com/shorts/-S_9Kuy8faU','https://www.youtube.com/embed/-S_9Kuy8faU','https://www.youtube.com/live/-S_9Kuy8faU?feature=share'])expect(youtubeId(url)).toBe('-S_9Kuy8faU');
    for(const url of ['https://vimeo.com/123','https://www.youtube.com/@channel','https://evil.example/watch?v=-S_9Kuy8faU','not a url','https://youtu.be/short'])expect(youtubeId(url)).toBe(null);
  });
});
