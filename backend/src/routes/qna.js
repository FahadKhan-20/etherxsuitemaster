const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const MeetingRoom = require('../models/MeetingRoom');
const auth = require('../middleware/auth');

const MAX_QUESTION_LENGTH = 500;
const MIN_QUESTION_LENGTH = 3;

const normalizeRoomCode = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const normalizeQuestionText = (value) => value.trim().replace(/\s+/g, ' ');

const serializeQuestion = (question, userId) => {
  const plainQuestion = question.toObject ? question.toObject() : { ...question };
  const upvotedBy = Array.isArray(plainQuestion.upvotedBy) ? plainQuestion.upvotedBy : [];

  return {
    ...plainQuestion,
    status: String(plainQuestion.status || 'OPEN').toUpperCase(),
    hasUpvoted: upvotedBy.some((id) => String(id) === String(userId)),
    upvotedBy: undefined,
  };
};

/**
 * GET /api/qna/:roomCode/questions
 * Fetch all questions for a room, sorted by upvotes DESC then createdAt DESC.
 * Any authenticated user may query.
 */
router.get('/:roomCode/questions', auth, async (req, res, next) => {
  try {
    const roomCode = normalizeRoomCode(req.params.roomCode);
    if (!roomCode) {
      return res.status(400).json({ success: false, message: 'Invalid room code.' });
    }

    const questions = await Question.find({ roomCode: roomCode.toLowerCase() })
      .sort({ upvotes: -1, createdAt: -1 })
      .lean();

    const userId = req.user.id;
    const sanitized = questions.map((question) => serializeQuestion(question, userId));

    return res.json({ success: true, data: sanitized });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/qna/:roomCode/questions
 * Submit a new question. Only authenticated users.
 */
router.post('/:roomCode/questions', auth, async (req, res, next) => {
  try {
    const roomCode = normalizeRoomCode(req.params.roomCode);
    const { text } = req.body;

    if (!roomCode) {
      return res.status(400).json({ success: false, message: 'Invalid room code.' });
    }

    const sanitizedText = typeof text === 'string' ? normalizeQuestionText(text) : '';

    if (sanitizedText.length < MIN_QUESTION_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Question must be at least ${MIN_QUESTION_LENGTH} characters.`,
      });
    }

    if (sanitizedText.length > MAX_QUESTION_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Question must not exceed ${MAX_QUESTION_LENGTH} characters.`,
      });
    }

    const meetingRoom = await MeetingRoom.findOne({ roomCode });
    if (!meetingRoom) {
      return res.status(404).json({
        success: false,
        message: 'Meeting room not found. Ask the host to open the meeting first.',
      });
    }

    const question = await Question.create({
      roomCode,
      userId: req.user.id,
      userName: req.user.name || 'Participant',
      text: sanitizedText,
    });

    // Attach io from app to emit real-time events
    const io = req.app.get('io');
    if (io) {
      io.to(roomCode).emit('qna:question-created', serializeQuestion(question, req.user.id));
    }

    return res.status(201).json({
      success: true,
      data: serializeQuestion(question, req.user.id),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/qna/questions/:questionId/upvote
 * Toggle upvote on a question. Prevents duplicate upvotes.
 */
router.post('/questions/:questionId/upvote', auth, async (req, res, next) => {
  try {
    const { questionId } = req.params;
    const userId = req.user.id;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    const hasUpvoted = question.upvotedBy.some((id) => String(id) === String(userId));

    if (hasUpvoted) {
      // Remove upvote
      question.upvotedBy = question.upvotedBy.filter((id) => String(id) !== String(userId));
      question.upvotes = Math.max(0, question.upvotes - 1);
    } else {
      // Add upvote
      question.upvotedBy.push(userId);
      question.upvotes += 1;
    }

    await question.save();

    const payload = serializeQuestion(question, userId);

    const io = req.app.get('io');
    if (io) {
      io.to(question.roomCode).emit('qna:question-upvoted', payload);
    }

    return res.json({ success: true, data: payload });
  } catch (error) {
    return next(error);
  }
});

/**
 * PATCH /api/qna/questions/:questionId/answer
 * Mark question as answered. Only the authenticated room host may do this.
 */
router.patch('/questions/:questionId/answer', auth, async (req, res, next) => {
  try {
    const { questionId } = req.params;

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    const room = await MeetingRoom.findOne({ roomCode: question.roomCode });
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Meeting room not found.',
      });
    }

    if (String(room.hostUserId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Only the host can mark questions as answered.',
      });
    }

    question.status = 'ANSWERED';
    question.answeredBy = req.user.name || room.hostName || 'Host';
    question.answeredByUserId = req.user.id;
    question.answeredAt = new Date();
    await question.save();

    const payload = serializeQuestion(question, req.user.id);

    const io = req.app.get('io');
    if (io) {
      io.to(question.roomCode).emit('qna:question-answered', payload);
    }

    return res.json({ success: true, data: payload });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
