const express = require('express');
const auth = require('../middleware/auth');
const MeetingRoom = require('../models/MeetingRoom');
const ChatMessage = require('../models/ChatMessage');
const { getSessionStart, registerRoomHost, rooms, isPrivileged } = require('../signaling');

const router = express.Router();

const normalizeRoomCode = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const {getMeetingPolicy} = require('../meetingExtensions');
const findRoomMember = (roomCode, userId) => [...(rooms.get(roomCode)?.values() || [])].find(member => String(member.userId) === String(userId));

router.get('/:code/participants', (req, res) => {
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
    if(!process.env.EMAILJS_INVITE_TEMPLATE_ID||!process.env.EMAILJS_SERVICE_ID||!process.env.EMAILJS_PUBLIC_KEY){
      return res.json({success:true,mode:'draft',mailto:'mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent('Join the meeting: '+link+'\nRoom code: '+code)});
    }
    const emailjs=require('@emailjs/nodejs');
    await emailjs.send(process.env.EMAILJS_SERVICE_ID,process.env.EMAILJS_INVITE_TEMPLATE_ID,{to_email:email,host_name:member.userName,meeting_link:link,room_code:code},{publicKey:process.env.EMAILJS_PUBLIC_KEY,privateKey:process.env.EMAILJS_PRIVATE_KEY});
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
