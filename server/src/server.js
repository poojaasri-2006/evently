const { createServer } = require('http');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const app = require('./app');
const prisma = require('./utils/prisma');
const { getRedis } = require('./utils/redis');
const { isAllowedOrigin } = require('./utils/origins');
let adapterReady;
const initializeAdapter = async () => {
  const publisher = await getRedis();
  if (!publisher) return;
  const subscriber = publisher.duplicate();
  subscriber.on('error', error => console.error('[Socket Redis]', error.message));
  await subscriber.connect();
  io.adapter(createAdapter(publisher, subscriber));
};
const ready = () => adapterReady ||= initializeAdapter().catch(error => { adapterReady = null; throw error; });
const server = createServer(async (req, res) => {
  try { await ready(); app(req, res); }
  catch (error) { console.error('[Server initialization]', error.message); res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message: 'Service configuration or storage connection unavailable.' })); }
});
const io = new Server(server, {
  path: process.env.VERCEL ? '/api/socket.io' : '/socket.io',
  transports: ['websocket'],
  allowRequest: (req, callback) => callback(null, isAllowedOrigin(req.headers.origin, req))
});
io.use(async (socket, next) => {
  try {
    await ready();
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const account = await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true } });
    if (!account) return next(new Error('Account no longer exists'));
    socket.userId = account.id; next();
  } catch { next(new Error('Invalid session or realtime service unavailable')); }
});
io.on('connection', socket => socket.join('user:' + socket.userId));
app.set('io', io);
module.exports = server;
