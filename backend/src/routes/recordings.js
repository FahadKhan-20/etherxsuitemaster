const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const Recording = require('../models/Recording');
const auth = require('../middleware/auth');
const { roomAllowsRecording } = require('../recordingPolicy');

const router = express.Router();
const uploadsDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsDir);
  },
  filename: (_req, file, callback) => {
    callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
  },
});

// About two hours of 1080p MediaRecorder output.
const MAX_RECORDING_BYTES = 2 * 1024 ** 3;
const PLAY_LINK_SECONDS = 60 * 60;
const SHARE_LINK_SECONDS = 7 * 24 * 60 * 60;

const upload = multer({
  storage,
  limits: { fileSize: MAX_RECORDING_BYTES, files: 1, fields: 10 },
  fileFilter: (_req, file, callback) => {
    const allowedMimeTypes = ['video/webm', 'video/mp4'];

    // MediaRecorder includes codec parameters (e.g. video/webm;codecs=vp9,opus).
    const mediaType = file.mimetype.split(';', 1)[0].trim().toLowerCase();
    if (allowedMimeTypes.includes(mediaType)) {
      return callback(null, true);
    }

    return callback(new Error('Only video/webm and video/mp4 files are allowed.'));
  },
});

const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({
        success: false,
        message: tooLarge ? 'Recording is larger than 2 GB.' : error.message,
      });
    }

    return next();
  });
};

const cleanupUploadedFile = async (filename) => {
  if (!filename) {
    return;
  }

  const filePath = path.join(uploadsDir, filename);

  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
};

// Streams a recording file; honours a single Range so players can seek. ?download=1 saves instead of playing.
const sendRecording = (req, res, recording) => {
  const filePath = path.join(uploadsDir, path.basename(recording.filename));
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Recording file not found.' });
  }
  const size = fs.statSync(filePath).size;
  const extension = path.extname(recording.filename).toLowerCase();
  const name = (recording.originalName || recording.filename).replace(/[^\w.\- ]+/g, '_');
  res.setHeader('Content-Type', extension === '.mp4' ? 'video/mp4' : 'video/webm');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', `${req.query?.download === '1' ? 'attachment' : 'inline'}; filename="${name}"`);
  res.setHeader('X-Recording-Duration', String(recording.duration || 0));

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers?.range || '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      res.setHeader('Content-Range', `bytes */${size}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', end - start + 1);
    return fs.createReadStream(filePath, { start, end }).pipe(res);
  }
  res.setHeader('Content-Length', size);
  return fs.createReadStream(filePath).pipe(res);
};

router.post('/upload', auth, handleUpload, async (req, res, next) => {
  try {
    const { roomCode, duration } = req.body;

    if (!roomCode) {
      await cleanupUploadedFile(req.file?.filename);

      return res.status(400).json({
        success: false,
        message: 'roomCode is required.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Recording file is required.',
      });
    }

    if (!(await roomAllowsRecording(roomCode.trim().toLowerCase()))) {
      await cleanupUploadedFile(req.file.filename);
      return res.status(403).json({ success: false, message: 'The host has turned recording off for their meetings.' });
    }

    const recording = await Recording.create({
      roomCode: roomCode.trim().toLowerCase(),
      uploadedBy: req.user.id,
      filename: req.file.filename,
      // multer reads the multipart filename as latin1; names with accents or dashes need UTF-8.
      originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
      size: req.file.size,
      duration: Number(duration) || 0,
    });

    return res.status(201).json({
      success: true,
      data: {
        recording,
      },
    });
  } catch (error) {
    await cleanupUploadedFile(req.file?.filename);
    return next(error);
  }
});

router.get('/', auth, async (req, res, next) => {
  try {
    const recordings = await Recording.findByOwner(req.user.id);

    return res.json({
      success: true,
      data: {
        recordings,
      },
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * Signed link for <video src>, downloads and sharing (browsers cannot attach the Authorization header there).
 * Only the owner can create one; deleting the recording revokes every link.
 */
router.post('/:id/link', auth, async (req, res, next) => {
  try {
    const recording = await Recording.findOwned(req.params.id, req.user.id);
    if (!recording) {
      return res.status(404).json({ success: false, message: 'Recording not found.' });
    }
    const expiresIn = req.body?.share ? SHARE_LINK_SECONDS : PLAY_LINK_SECONDS;
    const token = jwt.sign({ purpose: 'recording', rid: String(recording._id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn });
    return res.json({
      success: true,
      url: `/api/recordings/${recording._id}/stream?token=${encodeURIComponent(token)}`,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/stream', async (req, res, next) => {
  let claims;
  try {
    claims = jwt.verify(String(req.query?.token || ''), process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    claims = null;
  }
  if (!claims || claims.purpose !== 'recording' || claims.rid !== req.params.id) {
    return res.status(401).json({ success: false, message: 'This recording link is invalid or has expired.' });
  }
  try {
    const recording = await Recording.findById(req.params.id);
    if (!recording) {
      return res.status(404).json({ success: false, message: 'Recording not found.' });
    }
    return sendRecording(req, res, recording);
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', auth, async (req, res, next) => {
  try {
    const recording = await Recording.findOwned(req.params.id, req.user.id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found.',
      });
    }

    return sendRecording(req, res, recording);
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const recording = await Recording.findById(req.params.id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: 'Recording not found.',
      });
    }

    if (String(recording.uploadedBy._id) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to delete this recording.',
      });
    }

    await cleanupUploadedFile(recording.filename);
    await Recording.remove(recording._id);

    return res.json({
      success: true,
      data: {
        message: 'Recording deleted successfully.',
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
module.exports.MAX_RECORDING_BYTES = MAX_RECORDING_BYTES;
