const express   = require('express');
const http      = require('http');
const socketIo  = require('socket.io');
const cors      = require('cors');
require('dotenv').config();


//Initialize Firebase first (before anything else)
const db = require('./src/config/firebase');

//Import MQTT and the Automated Engine of the system in the  service 
const mqttService = require('./src/services/mqttService');
const automationEngine = require('./src/services/automationEngine');
const schedulerService = require('./src/services/schedulerService');
const emailService     = require('./src/services/emailService');
const businessRoutes = require('./src/routes/businessRoutes');
const devicesRoute   = require("./src/routes/devicesRoute");

// console.log('Checking import:', devicesRoute);



//Create Express app and HTTP server
const app    = express();
const server = http.createServer(app);

//Configure Socket.io (WebSocket)
const io = socketIo(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:3000',
      process.env.FRONTEND_URL,
    ].filter(Boolean),
    methods:     ['GET', 'POST'],
    credentials: true,
  },
});

//Global middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Make io accessible in routes and controllers
app.set('io', io);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status:        'running',
    projec:         'Automate Enegy management system',
    environment:   process.env.NODE_ENV,
    timestamp:     new Date().toISOString(),
    uptime_sec:    Math.floor(process.uptime()),
    mqtt_connected: mqttService.getIsConnected(),
    automation_engine: automationEngine.getStatus(),
    automation_engine: automationEngine.getStatus(),
    scheduler:         schedulerService.getStatus(),
  });
});

// Import all route files
const authenticationRoutes  = require('./src/routes/authenticationRouts');
const readingsRoutes = require('./src/routes/readingsRoutes');
const roomsRoutes    = require('./src/routes/roomsRoutes');
const alertsRoutes   = require('./src/routes/alertsRoutes');
const billRoutes     = require('./src/routes/billRoutes');


// Register routes with base paths
app.use('/api/auth',     authenticationRoutes);
app.use('/api/readings', readingsRoutes);
app.use('/api/rooms',    roomsRoutes);
app.use('/api/alerts',   alertsRoutes);
app.use('/api/bill',     billRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/device',   devicesRoute);


//404 handler
app.use((req, res) => {
  res.status(404).json({
    error:  'Route not found',
    path:   req.originalUrl,
    method: req.method,
  });
});

//Global error handler 
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({
    error:   'Internal server error',
    message: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Something went wrong',
  });
});

//WebSocket connection handler
io.on('connection', (socket) => {
  console.log(`Dashboard connected: ${socket.id}`);

  // Handle relay control commands from dashboard
  socket.on('control_device', (command) => {
    console.log('Control command from dashboard:', command);
    mqttService.publishCommand(command.device_id, command);
  });

  socket.on('disconnect', () => {
    console.log(`Dashboard disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {

  //Initialize MQTT AFTER server starts
  mqttService.initialize(io);

  const automationEngine = require('./src/services/automationEngine');
  automationEngine.initialize(io);

  schedulerService.initialize();
  emailService.verifyConfiguration();
});

// Export the server, app and the io to the othere module.
module.exports = { app, server, io };