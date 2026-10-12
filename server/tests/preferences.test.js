const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('http');
const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
require('dotenv').config({ quiet: true });
const prisma = require('../src/utils/prisma');
const app = require('../src/app');
test('simultaneous first-time settings reads create one preference record', { timeout: 90000 }, async () => {
  const user = await prisma.user.create({ data: { email: 'workflow-preferences-' + randomUUID() + '@example.test', password: 'not-used-for-login', role: 'ORGANIZER' } });
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const url = 'http://127.0.0.1:' + server.address().port + '/api/profile/notification-preferences';
    const responses = await Promise.all(Array.from({ length: 4 }, () => fetch(url, { headers: { Authorization: 'Bearer ' + token } }).then(async r => ({ status: r.status, data: await r.json() }))));
    assert(responses.every(r => r.status === 200));
    assert(responses.every(r => r.data.eventUpdates === true));
    assert.equal(await prisma.notificationPreference.count({ where: { userId: user.id } }), 1);
    console.log('Four concurrent first-time preference reads passed; exactly one record created.');
  } finally {
    await prisma.notificationPreference.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
});
