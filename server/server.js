require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = require('./src/app');
const prisma = require('./src/utils/prisma');
const { createServer } = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 5000;

const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  }
});

// Authenticate the socket handshake; valid tokens join the user's room.
// Connections without a valid token still connect (as guests) but receive nothing.
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const account = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true } });
    if (!account) return next(new Error('Account no longer exists'));
    socket.userId = account.id;
    next();
  } catch {
    next(); // guest connection
  }
});

io.on('connection', (socket) => {
  if (socket.userId) {
    socket.join(`user:${socket.userId}`);
  }
  socket.on('disconnect', () => {});
});

// Make io available to controllers via req.app.get('io')
app.set('io', io);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
