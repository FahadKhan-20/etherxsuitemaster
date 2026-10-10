const { meetingMetrics } = require('./meetingMetrics');
const { safeAck, guardedOn } = require('./socketGuard');
// Server-authoritative policies and subgroup membership for the reference meeting UI.
const policies = new Map(), breakouts = new Map(), ended = new Set();
// roomCode -> socketId the host spotlighted: shown large for everyone.
const spotlights = new Map();
const defaults = { waitingRoom: true, allowChat: true, allowShare: true, allowDrawing: false };
const getMeetingPolicy = code => ({ ...defaults, ...policies.get(code) });
const getGroup = (code, id) => breakouts.get(code)?.assignments?.[id] || 'main';
function registerMeetingExtensions(io, socket, context) {
  const { roomCode, getRoom, privileged, host, setHand, setNotes, screenShares, recordings } = context;
  const roster = () => { const code=roomCode();if(!code)return;io.to(code).emit('roster-state',{members:[...(getRoom()?.values()||[])].map(p=>({...p,group:getGroup(code,p.socketId)}))});
    // The spotlight ends when that person leaves.
    if(spotlights.has(code)&&!getRoom()?.has(spotlights.get(code))){spotlights.delete(code);io.to(code).emit('spotlight-state',{socketId:null});} };
  const snapshot = () => {const code=roomCode();if(!code)return;socket.emit('meeting-policy',getMeetingPolicy(code));socket.emit('breakout-state',publicBreakout(code));socket.emit('spotlight-state',{socketId:spotlights.get(code)||null});for(const member of getRoom()?.values()||[]){const peer=io.sockets.sockets.get(member.socketId);if(member.socketId!==socket.id&&getGroup(code,member.socketId)===getGroup(code,socket.id))socket.emit('peer-quality-request',{socketId:member.socketId,low:!!peer?.data.lowBandwidth});}roster();};
  const resetMedia = code => {
    const room=getRoom();if(!room)return;
    // Tear down old links before offering to peers in the new subgroup.
    for(const member of room.values()){
      const target=io.sockets.sockets.get(member.socketId);if(!target)continue;
      for(const other of room.values())if(other.socketId!==member.socketId)target.emit('user-left',{socketId:other.socketId});
    }
    const members=[...room.values()];
    members.forEach((member,index)=>{
      const group=getGroup(code,member.socketId),sharer=screenShares.get(code);io.to(member.socketId).emit('screen-share-state',{socketId:sharer&&getGroup(code,sharer)===group?sharer:null});
      io.to(member.socketId).emit('existing-users',members.slice(0,index).filter(p=>getGroup(code,p.socketId)===group));
      members.slice(index+1).filter(p=>getGroup(code,p.socketId)===group).forEach(other=>io.to(member.socketId).emit('user-joined',{...other,isMuted:other.selfMuted,mutedByHost:other.hostMuted}));
    });
    roster();
  };
  const closeBreakouts = () => {const code=roomCode();const session=breakouts.get(code);if(session?.timer)clearTimeout(session.timer);breakouts.delete(code);io.to(code).emit('breakout-state',null);resetMedia(code);};
  const on = (event,callback,admin=false) => guardedOn(socket,event,(payload={},rawAck)=>{
    const ack=safeAck(rawAck);
    if(!payload || typeof payload!=='object'||Array.isArray(payload))return;
    const room=getRoom(),member=room?.get(socket.id),code=roomCode();
    if(!member || (payload.roomCode&&payload.roomCode!==code))return ack({ok:false,error:'Join this meeting first.'});
    if(admin&&!privileged(code,member.userId))return ack({ok:false,error:'Host permission required.'});
    return callback(payload,ack,member,room,code);
  });
  on('request-media-quality',({low},ack,_member,room,code)=>{socket.data.lowBandwidth=!!low;for(const member of room.values())if(member.socketId!==socket.id&&getGroup(code,member.socketId)===getGroup(code,socket.id))io.to(member.socketId).emit('peer-quality-request',{socketId:socket.id,low:!!low});ack({ok:true});});
  on('get-meeting-state',()=>snapshot());
  on('meeting-policy-set',(payload,ack,_member,_room,code)=>{
    const next=getMeetingPolicy(code);for(const key of Object.keys(defaults))if(typeof payload[key]==='boolean')next[key]=payload[key];policies.set(code,next);io.to(code).emit('meeting-policy',next);
    if(!next.waitingRoom&&!context.locked(code))for(const pending of io.sockets.sockets.values())if(pending.data.requestedRoom===code){pending.data.admittedRoom=code;pending.emit('admitted',{roomCode:code});io.to(code).emit('join-request-cancelled',{socketId:pending.id});}
    ack({ok:true});
  },true);
  on('rename-participant',({name},ack,member,_room,code)=>{
    const clean=String(name||'').trim().slice(0,80);if(!clean)return ack({ok:false,error:'Enter a display name.'});member.userName=clean;io.to(code).emit('participant-renamed',{socketId:socket.id,name:clean});roster();ack({ok:true});
  });
  on('lower-participant-hand',({socketId},ack,member,room,code)=>{if(socketId!==socket.id&&!privileged(code,member.userId))return ack({ok:false,error:'Host permission required.'});if(room.has(socketId))setHand(code,socketId,room.get(socketId).userName,false);ack({ok:true});});
  on('mute-all',(_payload,ack,_member,room,code)=>{for(const other of room.values()){if(other.socketId===socket.id)continue;other.hostMuted=true;io.to(other.socketId).emit('participant-mute-command',{muted:true,mutedByHost:true});io.to(code).emit('participant-audio-state',{socketId:other.socketId,muted:true,mutedByHost:true});}roster();ack({ok:true});},true);
  on('remove-shared-file',({id},ack,_member,_room,code)=>{context.removeFile(code,id);ack({ok:true});},true);
  on('media-playback',({time,paused},ack,_member,_room,code)=>{if(!Number.isFinite(time)||time<0)return;const state={time,paused:!!paused,sentAt:Date.now()};context.setPlayback(code,state);socket.to(code).emit('media-playback',state);ack({ok:true});},true);
  on('breakout-open',({groups,minutes},ack,_member,room,code)=>{
    if(!Array.isArray(groups)||groups.length<2||groups.length>4||![5,10,15].includes(minutes))return ack({ok:false,error:'Choose 2–4 rooms and 5, 10, or 15 minutes.'});
    const assignments={},used=new Set();const valid=groups.map((ids,i)=>({id:'breakout-'+(i+1),name:'Room '+(i+1),members:(Array.isArray(ids)?ids:[]).filter(id=>room.has(id)&&id!==socket.id&&!used.has(id)&&used.add(id))}));
    if(!used.size)return ack({ok:false,error:'At least one other participant is required.'});
    valid.forEach(group=>group.members.forEach(id=>assignments[id]=group.id));const old=breakouts.get(code);if(old?.timer)clearTimeout(old.timer);
    const session={rooms:valid,assignments,endsAt:Date.now()+minutes*60000};session.timer=setTimeout(closeBreakouts,minutes*60000);session.timer.unref?.();breakouts.set(code,session);
    screenShares.delete(code);io.to(code).emit('screen-share-state',{socketId:null});io.to(code).emit('breakout-state',publicBreakout(code));resetMedia(code);ack({ok:true});
  },true);
  on('breakout-visit',({groupId},ack,member,_room,code)=>{
    const session=breakouts.get(code);if(!session)return ack({ok:false,error:'Breakout rooms are closed.'});
    // Participants stay in the room they were assigned; only the host or co-host moves between rooms.
    if(!privileged(code,member.userId))return ack({ok:false,error:'Only the host or co-host can switch rooms.'});
    if(groupId!=='main'&&!session.rooms.some(g=>g.id===groupId))return ack({ok:false,error:'Room unavailable.'});session.assignments[socket.id]=groupId;io.to(code).emit('breakout-state',publicBreakout(code));resetMedia(code);ack({ok:true});
  });
  // Host or co-host spotlights one participant for everyone (null clears it).
  on('spotlight-set',({socketId},ack,_member,room,code)=>{
    if(socketId!==null&&!room.has(socketId))return ack({ok:false,error:'That person has left.'});
    if(socketId)spotlights.set(code,socketId);else spotlights.delete(code);
    io.to(code).emit('spotlight-state',{socketId:socketId||null});ack({ok:true});
  },true);
  on('breakout-close',(_payload,ack)=>{closeBreakouts();ack({ok:true});},true);
  on('end-meeting',({notes},ack,_member,room,code)=>{ended.add(code);if(typeof notes==='string')setNotes(code,notes.slice(0,20000));if(breakouts.has(code))closeBreakouts();recordings.delete(code);io.to(code).emit('meeting-ended',{roomCode:code});ack({ok:true});for(const member of room.values()){const target=io.sockets.sockets.get(member.socketId);target?.disconnect(true);}meetingMetrics.finish(code);},true);
  return {snapshot,roster};
}
function publicBreakout(code){const session=breakouts.get(code);return session?{rooms:session.rooms,assignments:session.assignments,endsAt:session.endsAt}:null;}
function clearMeetingExtensions(code){const session=breakouts.get(code);if(session?.timer)clearTimeout(session.timer);breakouts.delete(code);policies.delete(code);spotlights.delete(code);}
module.exports={registerMeetingExtensions,getMeetingPolicy,getGroup,meetingEnded:code=>ended.has(code),clearMeetingExtensions};
