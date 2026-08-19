const path = require('path');
const http = require('http');
const express = require('express');
const { setupSignaling, rooms } = require('./signaling');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const passport = require('passport');

const connectDB = require('./config/db');
const configurePassport = require('./config/passport');

// Routes
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const recordingRoutes = require('./routes/recordings');
const livekitRoutes = require('./routes/livekit');
const feedbackRoutes = require('./routes/feedback');
const meetingAgendaRoutes = require('./routes/meetingAgendaRoutes');
const qnaRoutes = require('./routes/qna');

const errorHandler = require('./middleware/errorHandler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// =====================================================
// ALLOWED ORIGINS
// =====================================================
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.CLIENT_URL_LAN,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://10.190.103.55:3000',
].filter(Boolean);

// =====================================================
// PASSPORT CONFIGURATION
// =====================================================
configurePassport();

// =====================================================
// CORS CONFIGURATION
// =====================================================
const corsOptions = {
  origin: (origin, callback) => {
    // Dynamically allow the requesting origin
    // to support local network devices
    callback(null, true);
  },

  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],

  credentials: true,
};

// =====================================================
// MIDDLEWARE
// =====================================================
app.use(cors(corsOptions));

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

app.use(morgan('dev'));

app.use(express.json());

app.use(passport.initialize());

// Serve uploaded files
app.use(
  '/uploads',
  express.static(path.join(__dirname, '../uploads'))
);

// =====================================================
// API ROUTES
// =====================================================
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/recordings', recordingRoutes);

app.use('/api/livekit', livekitRoutes);

app.use('/api/feedback', feedbackRoutes);
app.use('/api/qna', qnaRoutes);

// Meeting Agenda Routes
app.use('/api/meeting-agenda', meetingAgendaRoutes);

// =====================================================
// GET ROOM PARTICIPANTS
// =====================================================
app.get('/api/rooms/:code/participants', (req, res) => {
  const { code } = req.params;

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

  res.json({
    success: true,
    participants: list,
  });
});

// =====================================================
// 404 ROUTE HANDLER
// =====================================================
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
  });
});

// =====================================================
// ERROR HANDLER
// =====================================================
app.use(errorHandler);

// =====================================================
// APPLICATION ERROR HANDLER
// =====================================================
app.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error('Server error:', error.message);
  }

  process.exit(1);
});

// =====================================================
// START SERVER
// =====================================================
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Create HTTP server
    const httpServer = http.createServer(app);
    const io = setupSignaling(httpServer, allowedOrigins);
    app.set('io', io);

    // Start server
    httpServer.listen(PORT, () => {
      console.log(
        `EtherXMeet backend running on http://localhost:${PORT}`
      );

      console.log(
        `EtherXMeet backend LAN: http://10.190.103.55:${PORT}`
      );

      console.log(
        `Meeting Agenda API: http://localhost:${PORT}/api/meeting-agenda`
      );
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();