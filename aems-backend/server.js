const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

// Initialize Firebase
require('./src/config/firebase');

// Services
const mqttService = require('./src/services/mqttService');
const automationEngine = require('./src/services/automationEngine');
const schedulerService = require('./src/services/schedulerService');
const emailService = require('./src/services/emailService');

// Routes
const authenticationRoutes = require('./src/routes/authenticationRouts');
const readingsRoutes = require('./src/routes/readingsRoutes');
const roomsRoutes = require('./src/routes/roomsRoutes');
const alertsRoutes = require('./src/routes/alertsRoutes');
const billRoutes = require('./src/routes/billRoutes');
const businessRoutes = require('./src/routes/businessRoutes');
const devicesRoute = require('./src/routes/devicesRoute');
const provisioningRoutes = require('./src/routes/provisioningRoutes');

const app = express();
const server = http.createServer(app);

// =====================================================
// CORS CONFIGURATION
// =====================================================

const configuredOrigins =
  process.env.CORS_ORIGINS ||
  process.env.FRONTEND_URL ||
  '';

const allowedOrigins = configuredOrigins
  ? configuredOrigins
      .split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
  : [];

console.log('Allowed Origins:', allowedOrigins);

// =====================================================
// EXPRESS CORS
// =====================================================

app.use(
  cors({
    origin(origin, callback) {
      // allow Postman, curl, mobile apps
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.error('Blocked by CORS:', origin);

      return callback(
        new Error(`Origin ${origin} not allowed by CORS`)
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// Handle browser preflight requests
// app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =====================================================
// SOCKET.IO
// =====================================================

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'running',
    project: 'Automated Energy Management System',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime_sec: Math.floor(process.uptime()),
    mqtt_connected: mqttService.getIsConnected(),
    automation_engine: automationEngine.getStatus(),
    scheduler: schedulerService.getStatus(),
  });
});

// =====================================================
// ROUTES
// =====================================================

app.use('/api/auth', authenticationRoutes);
app.use('/api/readings', readingsRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/bill', billRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/device', devicesRoute);
app.use('/api/provision', provisioningRoutes);

// =====================================================
// 404
// =====================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error',
    message:
      process.env.NODE_ENV === 'development'
        ? err.message
        : 'Something went wrong',
  });
});

// =====================================================
// SOCKET EVENTS
// =====================================================

io.on('connection', (socket) => {
  console.log(`Dashboard connected: ${socket.id}`);

  socket.on('control_device', (command) => {
    console.log('Control command:', command);

    mqttService.publishCommand(
      command.device_id,
      command
    );
  });

  socket.on('disconnect', () => {
    console.log(`Dashboard disconnected: ${socket.id}`);
  });
});

// =====================================================
// START SERVER
// =====================================================

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);

  mqttService.initialize(io);
  automationEngine.initialize(io);

  schedulerService.initialize();
  emailService.verifyConfiguration();

  console.log('Backend initialized successfully');
});

module.exports = {
  app,
  server,
  io,
};