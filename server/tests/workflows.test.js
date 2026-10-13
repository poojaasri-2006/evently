const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config({ quiet: true });
const prisma = require('../src/utils/prisma');
const app = require('../src/app');
const { deleteAccountData } = require('../src/utils/deleteAccountData');
const { chromium, expect: baseExpect } = require('@playwright/test');
const expect = baseExpect.configure({ timeout: 30000 });
const { io: socketClient } = require('socket.io-client');
const jwt = require('jsonwebtoken');

test('organizer and vendor workflows against isolated test accounts', { timeout: 1200000 }, async t => {
  const stamp = Date.now() + '-' + Math.random().toString(36).slice(2);
  const category = 'Workflow test ' + stamp;
  const accounts = [];
  const originalUsers = await prisma.user.findMany({ where: { email: { not: { startsWith: 'workflow-' } } }, select: { id: true } });
  const originalEvents = await prisma.event.findMany({ where: { organizer: { user: { email: { not: { startsWith: 'workflow-' } } } } }, select: { id: true } });
  const http = createServer(app);
  const io = new Server(http);
  io.use((socket, next) => { try { socket.userId = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET).id; next(); } catch { next(new Error('Unauthorized')); } });
  io.on('connection', socket => socket.join('user:' + socket.userId));
  app.set('io', io);
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + http.address().port;
  let browser, liveSocket;
  const proxyApi = async route => {
    try {
      const response = await route.fetch({ url: base + new URL(route.request().url()).pathname });
      await route.fulfill({ response });
    } catch (error) {
      if (!/disposed|closed|aborted|cancelled/i.test(error.message)) throw error;
      await route.abort().catch(() => {});
    }
  };
  let checks = 0;
  const api = async (actor, method, endpoint, body, status = 200) => {
    const response = await fetch(base + '/api/' + endpoint, { method, headers: { ...(actor ? { Authorization: 'Bearer ' + actor.token } : {}), 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (checks % 10 === 0) console.log('API progress: ' + checks + ' checks');
    assert.equal(response.status, status, method + ' ' + endpoint + ': ' + JSON.stringify(data));
    checks++;
    return data;
  };
  const register = async (role, label) => {
    const email = 'workflow-' + stamp + '-' + label + '@example.test';
    const result = await api(null, 'POST', 'auth/register', { fullName: 'Workflow ' + label, email, password: 'Workflow123!', phone: '1234567890', role, ...(role === 'VENDOR' ? { businessName: 'Test Vendor ' + stamp, businessCategory: category, businessLocation: 'Pune' } : {}) }, 201);
    const actor = { id: result.user.id, email, password: 'Workflow123!', role };
    accounts.push(actor);
    const login = await api(null, 'POST', 'auth/login', { email: email.toUpperCase(), password: actor.password });
    actor.token = login.token;
    actor.profile = await api(actor, 'GET', 'profile');
    return actor;
  };
  try {
    const org = await register('ORGANIZER', 'organizer');
    const other = await register('ORGANIZER', 'other');
    const vendor = await register('VENDOR', 'vendor');
    const vendorId = vendor.profile.vendorProfile.id;
    assert.equal(vendor.profile.vendorProfile.city, 'Pune');
    liveSocket = socketClient(base, { auth: { token: org.token }, transports: ['websocket'] });
    await new Promise((resolve, reject) => { liveSocket.once('connect', resolve); liveSocket.once('connect_error', reject); });
    const received = [];
    liveSocket.on('notification', n => received.push(n));
    const event = await api(org, 'POST', 'events', { name: 'Workflow Event', type: 'Wedding', date: '2035-01-10T10:00:00.000Z', location: 'Pune', guestCount: 20, budget: 2000 }, 201);
    await api(other, 'POST', 'shortlist', { eventId: event.id, vendorId }, 403);
    await api(org, 'POST', 'shortlist', { eventId: event.id, vendorId: 'missing-vendor' }, 404);
    const shortlist = await api(org, 'POST', 'shortlist', { eventId: event.id, vendorId }, 201);
    await api(org, 'POST', 'shortlist', { eventId: event.id, vendorId }, 409);
    await api(other, 'DELETE', 'shortlist/' + shortlist.id, undefined, 403);
    const req = await api(org, 'POST', 'events/' + event.id + '/requirements', { title: 'Photography', category: 'Photos' }, 201);
    await api(other, 'PATCH', 'events/' + event.id + '/requirements/' + req.id, { status: 'COMPLETED' }, 403);
    await api(org, 'PATCH', 'events/' + event.id + '/requirements/' + req.id, { title: 'Wedding photography', status: 'COMPLETED' });
    const service = await api(vendor, 'POST', 'vendor/services', { name: 'Photography', price: 100 }, 201);
    const cleared = await api(vendor, 'PATCH', 'vendor/services/' + service.id, { price: null });
    assert.equal(cleared.price, null);
    await api(vendor, 'PATCH', 'vendor/services/' + service.id, { price: -1 }, 400);
    await api(vendor, 'POST', 'vendor/packages', { name: 'Invalid', price: -1 }, 400);
    const pkg = await api(vendor, 'POST', 'vendor/packages', { name: 'Wedding Package', price: 100, serviceIds: [service.id] }, 201);
    const inquiry = await api(org, 'POST', 'inquiries', { eventId: event.id, vendorId, message: 'Please quote' }, 201);
    const quote = await api(vendor, 'POST', 'quotes', { inquiryId: inquiry.id, totalAmount: 100, details: 'Photography coverage' }, 201);
    assert(received.some(n => n.quoteId === quote.id));
    await api(other, 'PATCH', 'quotes/' + quote.id + '/status', { status: 'ACCEPTED' }, 403);
    await api(vendor, 'POST', 'vendor/availability', { date: '2035-01-10', isBlocked: true }, 201);
    await api(org, 'PATCH', 'quotes/' + quote.id + '/status', { status: 'ACCEPTED' }, 409);
    await api(vendor, 'POST', 'vendor/availability', { date: '2035-01-10', isBlocked: false });
    const accepted = await api(org, 'PATCH', 'quotes/' + quote.id + '/status', { status: 'ACCEPTED' });
    assert(accepted.booking && accepted.vendor && accepted.inquiry.event);
    await api(org, 'PATCH', 'quotes/' + quote.id + '/status', { status: 'ACCEPTED' }, 409);
    await api(vendor, 'POST', 'vendor/availability', { date: '2035-01-10', isBlocked: true }, 409);
    await api(org, 'GET', 'bookings/' + accepted.booking.id);
    await api(vendor, 'GET', 'vendor/bookings/' + accepted.booking.id);
    await api(other, 'GET', 'bookings/' + accepted.booking.id, undefined, 404);
    const budget = await api(org, 'GET', 'events/' + event.id + '/budget');
    assert.equal(budget.confirmedBookingTotal, 100);
    const item = await api(org, 'POST', 'events/' + event.id + '/budget/items', { category: 'Extras', amount: 50 }, 201);
    assert.equal((await api(org, 'GET', 'events/' + event.id + '/budget')).remainingBudget, 1850);
    await api(org, 'DELETE', 'events/' + event.id + '/budget/items/' + item.id);
    const collisionEvent = await api(org, 'POST', 'events', { name: 'Collision', date: event.date }, 201);
    const collisionInquiry = await api(org, 'POST', 'inquiries', { eventId: collisionEvent.id, vendorId, message: 'Same date' }, 201);
    const collisionQuote = await api(vendor, 'POST', 'quotes', { inquiryId: collisionInquiry.id, totalAmount: 100, details: 'Collision quote' }, 201);
    await api(org, 'PATCH', 'quotes/' + collisionQuote.id + '/status', { status: 'ACCEPTED' }, 409);
    const cancelled = await api(org, 'POST', 'inquiries', { eventId: collisionEvent.id, vendorId, message: 'Cancel me' }, 201);
    await api(org, 'PATCH', 'inquiries/' + cancelled.id + '/cancel', {});
    await api(vendor, 'PATCH', 'vendor/requests/' + cancelled.id + '/status', { status: 'ACCEPTED' }, 400);
    await api(org, 'POST', 'messages/' + vendor.id, { content: 'Organizer message' }, 201);
    await api(vendor, 'POST', 'messages/' + org.id, { content: 'Vendor reply' }, 201);
    assert.equal((await api(org, 'GET', 'messages/' + vendor.id)).length, 2);
    await api(other, 'GET', 'messages/' + vendor.id, undefined, 404);
    await api(org, 'POST', 'reviews', { vendorId, rating: 5, comment: 'Great vendor' }, 201);
    await api(org, 'POST', 'reviews', { vendorId, rating: 5 }, 409);
    const notices = await api(org, 'GET', 'notifications');
    await api(org, 'PATCH', 'notifications/' + notices[0].id + '/read');
    await api(other, 'PATCH', 'notifications/' + notices[0].id + '/read', {}, 403);
    await api(org, 'PATCH', 'notifications/read-all');
    assert.equal((await api(org, 'GET', 'notifications/unread-count')).count, 0);
    await api(org, 'PATCH', 'profile/notification-preferences', { quotesAndBookings: false });
    const beforeMute = received.length;
    const mutedEvent = await api(org, 'POST', 'events', { name: 'Muted event', date: '2035-01-11T10:00:00Z' }, 201);
    const mutedInquiry = await api(org, 'POST', 'inquiries', { eventId: mutedEvent.id, vendorId, message: 'Muted quote' }, 201);
    const beforeMutedQuote = received.length;
    await api(vendor, 'POST', 'quotes', { inquiryId: mutedInquiry.id, totalAmount: 50, details: 'Muted quote' }, 201);
    assert.equal(received.length, beforeMutedQuote);
    assert(beforeMutedQuote >= beforeMute);
    await api(org, 'PATCH', 'profile/notification-preferences', { quotesAndBookings: true });
    // More than five bookings must remain visible in the earnings report.
    for (let day = 12; day <= 17; day++) {
      const ev = await api(org, 'POST', 'events', { name: 'Earnings ' + day, date: '2035-01-' + day + 'T10:00:00Z' }, 201);
      const iq = await api(org, 'POST', 'inquiries', { eventId: ev.id, vendorId, message: 'Earnings request' }, 201);
      const q = await api(vendor, 'POST', 'quotes', { inquiryId: iq.id, totalAmount: 100, details: 'Earnings quote' }, 201);
      await api(org, 'PATCH', 'quotes/' + q.id + '/status', { status: 'ACCEPTED' });
      if (day === 12) assert.equal((await api(org, 'GET', 'events/' + ev.id + '/budget')).confirmedBookingTotal, 100);
    }
    const report = await api(vendor, 'GET', 'vendor-dashboard');
    assert.equal(report.earningsBookings.length, 7);
    assert.equal(report.stats.totalEarnings, 700);
    assert.equal(report.earningsBookings.reduce((sum,b) => sum+b.amount,0), 700);
    // Simultaneous decisions must produce only one booking for the vendor/date.
    const concurrentQuotes = [];
    for (const label of ['A', 'B']) {
      const ev = await api(org, 'POST', 'events', { name: 'Concurrent ' + label, date: '2035-02-01T10:00:00Z' }, 201);
      const iq = await api(org, 'POST', 'inquiries', { eventId: ev.id, vendorId, message: 'Concurrent booking' }, 201);
      concurrentQuotes.push(await api(vendor, 'POST', 'quotes', { inquiryId: iq.id, totalAmount: 100, details: 'Concurrent quote' }, 201));
    }
    const concurrentResults = await Promise.all(concurrentQuotes.map(q => fetch(base + '/api/quotes/' + q.id + '/status', { method: 'PATCH', headers: { Authorization: 'Bearer ' + org.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ACCEPTED' }) }).then(async response => ({ status: response.status, data: await response.json() }))));
    assert.deepEqual(concurrentResults.map(r => r.status).sort(), [200, 409]);
    await api(org, 'PATCH', 'bookings/' + concurrentResults.find(r => r.status === 200).data.booking.id + '/status', { status: 'CANCELLED' });
    await api(org, 'PATCH', 'events/' + event.id, { date: '2035-01-12T10:00:00Z' }, 409);
    const declinedInquiry = await api(org, 'POST', 'inquiries', { eventId: collisionEvent.id, vendorId, message: 'Decline me' }, 201);
    const declinedQuote = await api(vendor, 'POST', 'quotes', { inquiryId: declinedInquiry.id, totalAmount: 100, details: 'Declined quote' }, 201);
    await api(vendor, 'PATCH', 'vendor/requests/' + declinedInquiry.id + '/status', { status: 'DECLINED' });
    await api(org, 'PATCH', 'quotes/' + declinedQuote.id + '/status', { status: 'ACCEPTED' }, 409);
    console.log('Concurrency, rescheduling, and declined-inquiry checks passed.');
    // Real browser checks use this isolated API while keeping the user's running backend untouched.
    if (process.env.SKIP_BROWSER !== '1') {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ timezoneId: 'Asia/Kolkata', viewport: { width: 1280, height: 800 } });
      await context.route('http://localhost:5000/api/**', proxyApi);
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', e => pageErrors.push(e.message));
      await page.addInitScript(token => localStorage.setItem('evently_token', token), org.token);
      const client = process.env.TEST_CLIENT_URL || 'http://localhost:5173';
      const loginContext = await browser.newContext();
      await loginContext.route('http://localhost:5000/api/**', proxyApi);
      const loginPage = await loginContext.newPage();
      await loginPage.goto(client + '/login');
      await loginPage.getByPlaceholder('Enter your email').fill(org.email);
      await loginPage.getByPlaceholder('Enter your password').fill(org.password);
      await loginPage.getByRole('button', { name: 'Log In', exact: true }).click();
      await loginPage.waitForURL('**/organizer/dashboard');
      await expect(loginPage.locator('main')).toBeVisible();
      await loginContext.unrouteAll({ behavior: 'ignoreErrors' });
      await loginContext.close();
      const publicContext = await browser.newContext();
      await publicContext.route('http://localhost:5000/api/**', proxyApi);
      const publicPage = await publicContext.newPage();
      for (const route of ['/', '/register', '/find-vendors', '/vendor/' + vendorId]) {
        await publicPage.goto(client + route);
        await publicPage.waitForFunction(() => !document.body.innerText.includes('Loading...'));
        await expect(publicPage.locator('body')).not.toContainText(/Failed to load|Vendor not found/);
      }
      await publicContext.unrouteAll({ behavior: 'ignoreErrors' });
      await publicContext.close();
      const organizerRoutes = ['dashboard','events','events/' + event.id,'vendors','vendors/' + vendorId,'shortlist','compare','requests','quotes','quotes/' + quote.id,'bookings','bookings/' + accepted.booking.id,'messages','budget','notifications','profile','settings'];
      for (const route of organizerRoutes) {
        await page.goto(client + '/organizer/' + route);
        await page.waitForFunction(() => !document.body.innerText.includes('Loading...'));
        await expect(page.locator('main')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('main')).not.toContainText(/Oops!|Failed to load|Unable to load|Failed to fetch/);
        console.log('Browser organizer: ' + route);
      }
      await page.goto(client + '/organizer/events/' + event.id + '/edit');
      await expect(page.locator('input[name="date"]')).toHaveValue('2035-01-10T15:30');
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await page.waitForURL('**/organizer/events/' + event.id);
      assert.equal((await api(org, 'GET', 'events/' + event.id)).date, event.date);
      await page.getByLabel('Requirement title').fill('Browser requirement');
      await page.getByRole('button', { name: 'Add Requirement', exact: true }).click();
      await expect(page.getByText('Browser requirement', { exact: true })).toBeVisible();
      await page.goto(client + '/organizer/notifications');
      await expect(page.getByRole('heading', { name: 'Notifications' }).last()).toBeVisible();
      const inquiryCard = page.locator('.card').filter({ hasText: 'Inquiry Sent' }).first();
      await inquiryCard.click();
      await page.waitForURL('**/organizer/requests');
      await page.getByRole('link', { name: /^Notifications/ }).last().click();
      await page.waitForURL('**/organizer/notifications');
      await page.evaluate(token => localStorage.setItem('evently_token', token), vendor.token);
      // Init script is replaced for the vendor's separate context.
      const vendorContext = await browser.newContext({ timezoneId: 'Asia/Kolkata' });
      await vendorContext.addInitScript(token => localStorage.setItem('evently_token', token), vendor.token);
      await vendorContext.route('http://localhost:5000/api/**', proxyApi);
      const vp = await vendorContext.newPage();
      vp.on('pageerror', e => pageErrors.push(e.message));
      for (const route of ['dashboard','profile','services','packages','availability','requests','quotes','quotes/' + quote.id,'bookings','bookings/' + accepted.booking.id,'messages','reviews','earnings','notifications','settings']) {
        await vp.goto(client + '/vendor/' + route);
        await expect(vp.locator('main')).toBeVisible({ timeout: 15000 });
        await vp.waitForFunction(() => !document.body.innerText.includes('Loading...'));
        await expect(vp.locator('main')).not.toContainText(/Oops!|Failed to load|Unable to load|Failed to fetch/);
        console.log('Browser vendor: ' + route);
      }
      await vp.goto(client + '/vendor/earnings');
      await expect(vp.getByText('₹700', { exact: true }).first()).toBeVisible();
      assert.deepEqual(pageErrors, []);
      for (const current of browser.contexts()) await current.unrouteAll({ behavior: 'ignoreErrors' });
      await browser.close(); browser = null;
    }
    await api(org, 'PATCH', 'events/' + event.id, { status: 'CANCELLED' });
    assert.equal((await api(org, 'GET', 'bookings/' + accepted.booking.id)).status, 'CANCELLED');
    assert.equal((await api(org, 'GET', 'events/' + event.id + '/budget')).confirmedBookingTotal, 0);
    await api(org, 'PATCH', 'events/' + event.id, { status: 'DRAFT' }, 409);
    await api(org, 'POST', 'profile/password', { currentPassword: org.password, newPassword: 'x' }, 400);
    await api(org, 'POST', 'profile/password', { currentPassword: org.password, newPassword: 'Workflow456!' });
    org.password = 'Workflow456!';
    await api(org, 'POST', 'profile/delete-account', { password: 'wrong' }, 400);
    await api(vendor, 'POST', 'profile/delete-account', { password: vendor.password });
    await api(vendor, 'GET', 'auth/me', undefined, 401);
    assert.equal((await api(org, 'GET', 'bookings')).length, 0);
    await api(org, 'POST', 'profile/delete-account', { password: org.password });
    await api(org, 'GET', 'auth/me', undefined, 401);
    await api(other, 'POST', 'profile/delete-account', { password: other.password });
    assert.deepEqual((await prisma.user.findMany({ where: { email: { not: { startsWith: 'workflow-' } } }, select: { id: true } })).map(u=>u.id).sort(), originalUsers.map(u=>u.id).sort());
    assert.deepEqual((await prisma.event.findMany({ where: { organizer: { user: { email: { not: { startsWith: 'workflow-' } } } } }, select: { id: true } })).map(e=>e.id).sort(), originalEvents.map(e=>e.id).sort());
    console.log('Passed ' + checks + ' API assertions plus organizer/vendor browser checks. Existing account and event IDs preserved.');
  } finally {
    if (browser) { for (const current of browser.contexts()) await current.unrouteAll({ behavior: 'ignoreErrors' }); await browser.close(); }
    liveSocket?.close();
    for (const actor of accounts.reverse()) {
      const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { id: true, email: true } });
      if (user && user.email.startsWith('workflow-' + stamp + '-')) await prisma.$transaction(tx => deleteAccountData(tx, actor.id), { timeout: 90000 });
    }
    const testCategory = await prisma.vendorCategory.findUnique({ where: { name: category }, include: { _count: { select: { vendors: true, services: true, packages: true } } } });
    if (testCategory && Object.values(testCategory._count).every(n => n === 0)) await prisma.vendorCategory.delete({ where: { id: testCategory.id } });
    await new Promise(resolve => io.close(resolve));
    await prisma.$disconnect();
  }
});
