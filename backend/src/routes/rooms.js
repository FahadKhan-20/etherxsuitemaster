const express = require('express');
const auth = require('../middleware/auth');
const MeetingRoom = require('../models/MeetingRoom');
const ChatMessage = require('../models/ChatMessage');
const { getSessionStart, registerRoomHost, rooms, isPrivileged } = require('../signaling');

const router = express.Router();

const normalizeRoomCode = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const {getMeetingPolicy} = require('../meetingExtensions');
const { meetingMetrics } = require('../meetingMetrics');
const multer = require('multer');
const roomFiles = require('../roomFiles');

const fileUpload = multer({ dest: require('path').join(roomFiles.baseDir, '.incoming'), limits: { fileSize: roomFiles.MAX_FILE_BYTES, files: 1, fields: 5 } });
const handleFileUpload = (req, res, next) => fileUpload.single('file')(req, res, error => {
  if (!error) return next();
  return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ success: false, message: error.code === 'LIMIT_FILE_SIZE' ? 'Files must be under 10 MB.' : error.message });
});

// Meeting members upload a file once; the room is told about it, not sent it.
router.post('/:code/files', auth, handleFileUpload, (req, res) => {
  const code = normalizeRoomCode(req.params.code);
  const member = findRoomMember(code, req.user.id);
  if (!member) {
    if (req.file) require('fs').rm(req.file.path, { force: true }, () => {});
    return res.status(403).json({ success: false, message: 'Join this meeting before sharing files.' });
  }
  if (!req.file) return res.status(400).json({ success: false, message: 'Choose a file to share.' });
  const entry = roomFiles.add(code, { name: req.file.originalname, size: req.file.size, type: req.file.mimetype, tempPath: req.file.path, sharedBy: member.userName || 'Someone' });
  // The sharer's socket id lets the sharer skip their own "shared a file" popup.
  req.app.get('io')?.to(code).emit('file-shared', { ...roomFiles.publicFile(entry), sharedBySocketId: member.socketId });
  return res.status(201).json({ success: true, file: roomFiles.publicFile(entry) });
});

router.get('/:code/files/:id', auth, (req, res) => {
  const code = normalizeRoomCode(req.params.code);
  if (!findRoomMember(code, req.user.id)) return res.status(403).json({ success: false, message: 'Join this meeting to download its files.' });
  const entry = roomFiles.get(code, String(req.params.id));
  if (!entry) return res.status(404).json({ success: false, message: 'This file is no longer shared.' });
  const name = entry.name.replace(/[^\w.\- ]+/g, '_');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', entry.size);
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  return require('fs').createReadStream(entry.path).pipe(res);
});
const findRoomMember = (roomCode, userId) => [...(rooms.get(roomCode)?.values() || [])].find(member => String(member.userId) === String(userId));

// STUN plus a TURN relay for peers behind strict NATs. Configure your own relay in backend/.env;
// without one, a free public relay is used (shared and rate-limited, fine only for testing).
const PUBLIC_RELAY = ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'].map(urls => ({ urls, username: 'openrelayproject', credential: 'openrelayproject' }));
router.get('/ice-servers', auth, (req, res) => {
  const urls = String(process.env.TURN_URLS || '').split(',').map(url => url.trim()).filter(Boolean);
  const relay = urls.length ? [{ urls, username: process.env.TURN_USERNAME || '', credential: process.env.TURN_CREDENTIAL || '' }] : PUBLIC_RELAY;
  res.json({ success: true, iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, ...relay] });
});

// Signed-in users only: the lobby shows who is already in the call, but anonymous callers must not enumerate rooms.
router.get('/:code/participants', auth, (req, res) => {
  const code = normalizeRoomCode(req.params.code);
  const roomMap = rooms.get(code);

  if (!roomMap) {
    return res.json({
      success: true,
      participants: [],
    });
  }

  const list = Array.from(roomMap.values()).map((p) => ({
    userName: p.userName,
  }));

  return res.json({
    success: true,
    participants: list,
  });
});
router.get('/chat/:roomCode', auth, async (req, res, next) => {
  try {
    const roomCode = normalizeRoomCode(req.params.roomCode);
    if (!roomCode) {
      return res.status(400).json({ success: false, message: 'Invalid room code.' });
    }

    if (!findRoomMember(roomCode, req.user.id)) return res.status(403).json({ success: false, message: 'Join this meeting before opening its chat.' });

    // Only this meeting's messages — a reused room code must not show earlier meetings' chats.
    const sessionStart = getSessionStart(roomCode);
    if (!sessionStart) {
      return res.json({ success: true, data: [] });
    }

    const messages = await ChatMessage.find({ roomCode, createdAt: { $gte: sessionStart } }).sort({ createdAt: 1 }).lean();

    return res.json({ success: true, data: messages });
  } catch (error) {
    return next(error);
  }
});

router.post('/chat/:roomCode', auth, async (req, res, next) => {
  try {
    const roomCode = normalizeRoomCode(req.params.roomCode);
    const sanitizedMessage = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    if (!roomCode) {
      return res.status(400).json({ success: false, message: 'Invalid room code.' });
    }
    const member = findRoomMember(roomCode, req.user.id);
    if (!member) return res.status(403).json({ success: false, message: 'Join this meeting before sending messages.' });
    if(!getMeetingPolicy(roomCode).allowChat&&!isPrivileged(roomCode,req.user.id)) return res.status(403).json({success:false,message:'Chat is limited to hosts.'});
    if (!sanitizedMessage) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
    }
    if (sanitizedMessage.length > 1000) {
      return res.status(400).json({ success: false, message: 'Message must not exceed 1000 characters.' });
    }

    const chatMessage = await ChatMessage.create({
      roomCode,
      address: member.userName || req.user.name || 'Participant',
      senderId: req.user.id,
      message: sanitizedMessage,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(roomCode).emit('chat:message-created', chatMessage);
      meetingMetrics.count(roomCode, 'chat');
    }

    return res.status(201).json({ success: true, data: chatMessage });
  } catch (error) {
    return next(error);
  }
});

// Invitation delivery uses a dedicated template; never reuse the password-reset template.
router.post('/:code/invitations', auth, async (req,res,next)=>{
  try{
    const code=normalizeRoomCode(req.params.code),email=String(req.body?.email||'').trim();
    const member=findRoomMember(code,req.user.id);
    if(!member)return res.status(403).json({success:false,message:'Join this meeting before inviting people.'});
    if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({success:false,message:'Enter a valid email address.'});
    const origin=String(process.env.FRONTEND_URL||'http://localhost:3000').split(',')[0].replace(/\/$/,'');
    const link=origin+'/room/'+encodeURIComponent(code),subject='Join '+member.userName+' on EtherX Meet';
    const draft=()=>res.json({success:true,mode:'draft',mailto:'mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent('Join the meeting: '+link+'\nRoom code: '+code)});
    if(!process.env.EMAILJS_INVITE_TEMPLATE_ID||!process.env.EMAILJS_SERVICE_ID||!process.env.EMAILJS_PUBLIC_KEY)return draft();
    const emailjs=require('@emailjs/nodejs');
    try{
      await emailjs.send(process.env.EMAILJS_SERVICE_ID,process.env.EMAILJS_INVITE_TEMPLATE_ID,{to_email:email,host_name:member.userName,meeting_link:link,room_code:code},{publicKey:process.env.EMAILJS_PUBLIC_KEY,privateKey:process.env.EMAILJS_PRIVATE_KEY});
    }catch(error){
      // Misconfigured or unreachable email service: the inviter can still send the invite from their own mail app.
      console.error('Invitation email failed:',error?.text||error?.message||error);
      return draft();
    }
    return res.json({success:true,mode:'sent'});
  }catch(error){return next(error);}
});

router.post('/', auth, async (req, res, next) => {
  try {
    const roomCode = normalizeRoomCode(req.body?.roomCode);
    const hostName = typeof req.body?.hostName === 'string' && req.body.hostName.trim()
      ? req.body.hostName.trim()
      : req.user.name || 'Host';

    if (!roomCode) {
      return res.status(400).json({ success: false, message: 'roomCode is required.' });
    }

    const existingRoom = await MeetingRoom.findOne({ roomCode });

    if (existingRoom) {
      if (String(existingRoom.hostUserId) !== String(req.user.id)) {
        return res.status(409).json({
          success: false,
          message: 'This room is already owned by another host.',
        });
      }

      existingRoom.hostName = hostName;
      existingRoom.lastActiveAt = new Date();
      await existingRoom.save();
      registerRoomHost(roomCode, req.user.id, req.app.get('io'));

      return res.json({
        success: true,
        data: {
          roomCode: existingRoom.roomCode,
          hostName: existingRoom.hostName,
          hostUserId: existingRoom.hostUserId,
          createdAt: existingRoom.createdAt,
          updatedAt: existingRoom.updatedAt,
        },
      });
    }

    const room = await MeetingRoom.create({
      roomCode,
      hostUserId: req.user.id,
      hostName,
      lastActiveAt: new Date(),
    });
    registerRoomHost(roomCode, req.user.id, req.app.get('io'));

    return res.status(201).json({
      success: true,
      data: {
        roomCode: room.roomCode,
        hostName: room.hostName,
        hostUserId: room.hostUserId,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This room code has already been claimed.',
      });
    }

    return next(error);
  }
});

router.get('/:roomCode', auth, async (req, res, next) => {
  try {
    const roomCode = normalizeRoomCode(req.params.roomCode);

    if (!roomCode) {
      return res.status(400).json({ success: false, message: 'Invalid room code.' });
    }

    const room = await MeetingRoom.findOne({ roomCode }).lean();

    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found.' });
    }

    return res.json({
      success: true,
      data: {
        roomCode: room.roomCode,
        hostName: room.hostName,
        isHost: String(room.hostUserId) === String(req.user.id),
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
