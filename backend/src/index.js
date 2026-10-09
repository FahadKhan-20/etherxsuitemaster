const http = require('http');
const express = require('express');
const { setupSignaling, rooms } = require('./signaling');
const { corsOrigin } = require('./config/origins');
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
const feedbackRoutes = require('./routes/feedback');
const meetingAgendaRoutes = require('./routes/meetingAgendaRoutes');

const errorHandler = require('./middleware/errorHandler');

dotenv.config();

const app = express();
// Behind nginx (docker) or the Vite dev proxy, so rate limits see the real client address.
app.set('trust proxy', 'loopback, uniquelocal');
const PORT = process.env.PORT || 5000;


// =====================================================
// PASSPORT CONFIGURATION
// =====================================================
configurePassport();

// =====================================================
// CORS CONFIGURATION
// =====================================================
const corsOptions = {
  // Configured CLIENT_URL / CLIENT_URL_LAN / FRONTEND_URL; development also allows localhost and LAN addresses.
  origin: corsOrigin,

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

// Recordings in uploads/ are private: they are served only by /api/recordings with an owner check or a signed link.

// =====================================================
// ROOT ROUTE
// =====================================================
app.get('/', (_req, res) => {
  res.json({
    name: 'EtherXMeet Backend API Server',
    status: 'online',
    frontendUrl: process.env.CLIENT_URL || 'http://localhost:3000',
    documentation: '/api',
  });
});

// =====================================================
// API ROUTES
// =====================================================
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/recordings', recordingRoutes);


app.use('/api/feedback', feedbackRoutes);

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
    require('./retention').scheduleRetention();

    // Create HTTP server
    const httpServer = http.createServer(app);
    const io = setupSignaling(httpServer, corsOrigin);
    app.set('io', io);

    // Start server
    httpServer.listen(PORT, () => {
      console.log(
        `EtherXMeet backend running on http://localhost:${PORT}`
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