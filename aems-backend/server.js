const express   = require('express');
const http      = require('http');
const socketIo  = require('socket.io');
const cors      = require('cors');
require('dotenv').config();

// ── Initialize Firebase first (before anything else) ───────
const db = require('./src/config/firebase');

// ── Create Express app and HTTP server ─────────────────────
const app    = express();
const server = http.createServer(app);

// ── Configure Socket.io (WebSocket) ────────────────────────
const io = socketIo(server, {
  cors: {
    origin:  process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// ── Global middleware ───────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Make io accessible in routes/controllers ───────────────
app.set('io', io);

// ── Health check — always the first route ──────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:      'running',
    project:     'AEMS — Automated Energy Management System',
    developer:   'LEKEUGO DEMELIEU ROCHINEL',
    matricule:   'FE22A247',
    university:  'University of Buea, Cameroon',
    version:     '1.0.0',
    environment: process.env.NODE_ENV,
    timestamp:   new Date().toISOString(),
    uptime_sec:  Math.floor(process.uptime()),
  });
});

// ── 404 handler — catches any route not defined above ──────
app.use((req, res) => {
  res.status(404).json({
    error:   'Route not found',
    path:    req.originalUrl,
    method:  req.method,
  });
});

// ── Global error handler ────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({
    error:   'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// ── WebSocket connection handler ────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Dashboard connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔌 Dashboard disconnected: ${socket.id}`);
  });
});

// ── Start server ────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

server.listen(PORT);

// ── Export for testing ──────────────────────────────────────
module.exports = { app, server, io };