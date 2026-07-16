const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

// Load env FIRST before any module that reads process.env
dotenv.config();

const { testConnection } = require('./src/config/supabase');
const { setupSocketHandlers } = require('./src/socket/handlers');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

// Connect to Supabase
testConnection();

// Run lightweight schema migrations (safe to repeat)
(async () => {
  try {
    const { supabase: sb } = require('./src/config/supabase');
    // Add image_url to direct_messages if missing
    await sb.rpc('execute_sql', { sql: "ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS image_url TEXT" })
      .then(() => console.log('  ✓ image_url column ensured'))
      .catch(() => {
        // rpc may not exist; try raw query via REST — safe to ignore
        console.log('  (image_url migration skipped – add column manually if needed)');
      });
  } catch { }
})();

// Middleware
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make io accessible to routes
app.set('io', io);
// Also set global.io so notificationHelper can emit real-time events
global.io = io;

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/auth/oauth', require('./src/routes/oauth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/servers', require('./src/routes/servers'));
app.use('/api/channels', require('./src/routes/channels'));
app.use('/api/messages', require('./src/routes/messages'));
app.use('/api/posts', require('./src/routes/posts'));
app.use('/api/reports', require('./src/routes/reports'));
app.use('/api/recommendations', require('./src/routes/recommendations'));
app.use('/api/dm', require('./src/routes/dm'));
app.use('/api/friends', require('./src/routes/friends'));
app.use('/api/upload', require('./src/routes/upload'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/blocks', require('./src/routes/blocks'));
app.use('/api/admin', require('./src/routes/admin'));

// Socket.IO setup
setupSocketHandlers(io);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (all interfaces)`);
});