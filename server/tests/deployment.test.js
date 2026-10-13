const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { createServer } = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { io: socketClient } = require('socket.io-client');
const { createAdapter } = require('@socket.io/redis-adapter');

test('Vercel HTTP, cloud uploads, origins, and cross-instance notifications', { timeout: 30000 }, async t => {
  const keys = ['VERCEL','CLIENT_URL','REDIS_URL','JWT_SECRET','BLOB_READ_WRITE_TOKEN'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { VERCEL: '1', CLIENT_URL: 'https://evently.example', REDIS_URL: 'redis://test-only', JWT_SECRET: 'deployment-test-secret-only', BLOB_READ_WRITE_TOKEN: 'test-only-token' });
  const clients = new Set(); const commands = [];
  class SharedRedis extends EventEmitter {
    constructor() { super(); this.patterns = new Map(); this.channels = new Map(); this.isOpen = true; clients.add(this); }
    duplicate() { return new SharedRedis(); }
    async connect() { this.isOpen = true; }
    async pSubscribe(pattern, callback) { this.patterns.set(pattern, callback); }
    async subscribe(channels, callback) { for (const channel of Array.isArray(channels) ? channels : [channels]) this.channels.set(channel, callback); }
    async pUnsubscribe(pattern) { this.patterns.delete(pattern); }
    async unsubscribe(channels) { for (const channel of Array.isArray(channels) ? channels : [channels]) this.channels.delete(channel); }
    async publish(channel, message) {
      for (const client of clients) {
        for (const [pattern, callback] of client.patterns) if (channel.startsWith(pattern.slice(0, -1))) callback(message, channel);
        client.channels.get(channel)?.(message, channel);
      }
      return clients.size;
    }
    async sendCommand(args) { commands.push(args); return args[0] === 'SCRIPT' ? 'test-sha' : [1, 900000]; }
  }
  const redis = new SharedRedis();
  const redisModule = require('../src/utils/redis');
  t.mock.method(redisModule, 'getRedis', async () => redis);
  const blob = require('@vercel/blob'); const uploads = [];
  t.mock.method(blob, 'put', async (name, body, options) => { uploads.push({ name, body, options }); return { url: 'https://test.public.blob.vercel-storage.com/' + name }; });
  const prismaFile = require.resolve('../src/utils/prisma');
  const oldPrisma = require.cache[prismaFile];
  const account = { id: 'unit-user', role: 'VENDOR', email: 'test@example.test', vendorProfile: { id: 'unit-vendor', userId: 'unit-user' }, organizerProfile: null };
  let imageUrl;
  require.cache[prismaFile] = { id: prismaFile, filename: prismaFile, loaded: true, exports: {
    $queryRaw: async () => [account],
    user: { findUnique: async () => account },
    vendorProfile: { update: async ({ data }) => { imageUrl = data.imageUrl; return { ...account.vendorProfile, ...data }; } }
  } };
  let server, peerServer, peerIo, client;
  try {
    server = require('../../api/index');
    assert.equal(server.listening, false, 'Importing the Vercel function must not open a port');
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    let response = await fetch(base + '/api/health'); assert.equal(response.status, 200); assert.equal((await response.json()).status, 'ok');
    response = await fetch(base + '/api/health', { headers: { Origin: 'https://attacker.example' } }); assert.equal(response.status, 403);
    response = await fetch(base + '/api/health', { headers: { Origin: 'https://evently.example' } }); assert.equal(response.status, 200); assert.equal(response.headers.get('access-control-allow-origin'), 'https://evently.example');
    response = await fetch(base + '/api/health', { headers: { Origin: 'https://127.0.0.1:' + server.address().port } }); assert.equal(response.status, 200);
    response = await fetch(base + '/api/missing'); assert.equal(response.status, 404); assert.equal(response.headers.get('content-type').includes('json'), true);
    const token = jwt.sign({ id: account.id, role: 'VENDOR' }, process.env.JWT_SECRET);
    const upload = async (type, size) => {
      const body = new FormData(); body.append('image', new Blob([Buffer.alloc(size)], { type }), 'test.png');
      return fetch(base + '/api/profile/vendor/image', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body });
    };
    response = await upload('image/png', 20); assert.equal(response.status, 200);
    const uploaded = await response.json(); assert.equal(uploaded.imageUrl, imageUrl);
    assert(uploads[0].name.startsWith('profiles/vendor-unit-user-')); assert(Buffer.isBuffer(uploads[0].body)); assert.equal(uploads[0].options.access, 'public');
    response = await upload('text/plain', 20); assert.equal(response.status, 400);
    response = await upload('image/png', 4 * 1024 * 1024 + 1); assert.equal(response.status, 413);
    delete process.env.BLOB_READ_WRITE_TOKEN;
    response = await upload('image/png', 20); assert.equal(response.status, 503);
    assert.equal(uploads.length, 1, 'Invalid/unconfigured uploads must not reach Blob storage');
    assert(commands.some(args => args[0] === 'EVALSHA'), 'Rate limits must use the shared Redis store');

    client = socketClient(base, { auth: { token }, path: '/api/socket.io', transports: ['websocket'], reconnection: false });
    await new Promise((resolve,reject) => { client.once('connect', resolve); client.once('connect_error', reject); });
    peerServer = createServer(); peerIo = new Server(peerServer, { transports: ['websocket'] });
    peerIo.adapter(createAdapter(redis, redis.duplicate()));
    await new Promise(resolve => peerServer.listen(0, '127.0.0.1', resolve));
    const received = new Promise(resolve => client.once('notification', resolve));
    peerIo.to('user:' + account.id).emit('notification', { id: 'cross-instance', content: 'Delivery from another instance' });
    assert.equal((await received).id, 'cross-instance');
    console.log('Vercel entrypoint, shared rate limits, cloud upload validation, preview origins, and cross-instance socket delivery passed.');
  } finally {
    client?.close();
    if (peerIo) await new Promise(resolve => peerIo.close(resolve));
    if (server) await new Promise(resolve => require('../src/app').get('io').close(resolve));
    if (oldPrisma) require.cache[prismaFile] = oldPrisma; else delete require.cache[prismaFile];
    for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
  }
});

test('notification publication finishes before a serverless response may end', async t => {
  const redisSdk = require('redis');
  const redisFile = require.resolve('../src/utils/redis');
  const savedModule = require.cache[redisFile];
  const savedUrl = process.env.REDIS_URL;
  let release;
  const fake = Object.assign(new EventEmitter(), { isOpen: true, publish: () => new Promise(resolve => { release = resolve; }) });
  t.mock.method(redisSdk, 'createClient', () => fake);
  process.env.REDIS_URL = 'redis://test-only';
  delete require.cache[redisFile];
  try {
    const { getRedis, flushRedisPublishes } = require('../src/utils/redis');
    const client = await getRedis();
    void client.publish('notification', 'payload');
    let finished = false;
    const flushed = flushRedisPublishes().then(() => { finished = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(finished, false);
    release(1); await flushed;
    assert.equal(finished, true);
  } finally {
    require.cache[redisFile] = savedModule;
    if (savedUrl === undefined) delete process.env.REDIS_URL; else process.env.REDIS_URL = savedUrl;
  }
});
