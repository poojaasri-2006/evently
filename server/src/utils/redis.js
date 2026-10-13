const { createClient } = require('redis');
let client, connection;
const publications = new Set();
const getRedis = async () => {
  if (!process.env.REDIS_URL) {
    if (process.env.VERCEL) throw new Error('REDIS_URL is required on Vercel for shared notifications and rate limits.');
    return null;
  }
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL, socket: { connectTimeout: 10000, reconnectStrategy: retries => retries < 3 ? Math.min(1000 * (retries + 1), 3000) : new Error('Redis connection unavailable') } });
    const publish = client.publish.bind(client);
    client.publish = (...args) => {
      const promise = publish(...args); publications.add(promise);
      promise.then(() => publications.delete(promise), () => publications.delete(promise));
      return promise;
    };
    client.on('error', error => console.error('[Redis]', error.message));
  }
  if (!client.isOpen) {
    connection ||= client.connect().finally(() => { connection = null; });
    await connection;
  }
  return client;
};
const flushRedisPublishes = () => Promise.all([...publications]);
module.exports = { getRedis, flushRedisPublishes };
