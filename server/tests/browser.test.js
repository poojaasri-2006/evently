const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');
const { createServer } = require('http');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config({ quiet: true });
const prisma = require('../src/utils/prisma');
const app = require('../src/app');
const { deleteAccountData } = require('../src/utils/deleteAccountData');
const { chromium, expect: baseExpect } = require('../../client/node_modules/@playwright/test');
const expect = baseExpect.configure({ timeout: 30000 });

test('public, organizer, and vendor browser workflows', { timeout: 600000 }, async () => {
  const stamp = Date.now() + '-' + randomUUID();
  const accounts = [];
  const ids = Array.from({ length: 7 }, () => ({ event: randomUUID(), inquiry: randomUUID(), quote: randomUUID(), booking: randomUUID() }));
  let browser;
  const http = createServer(app);
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + http.address().port;
  const client = process.env.TEST_CLIENT_URL || 'http://localhost:5173';
  const password = 'Workflow123!';
  const passwordHash = await bcrypt.hash(password, 10);
  const api = async (token, method, endpoint, body) => {
    const response = await fetch(base + '/api/' + endpoint, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    assert(response.ok, endpoint + ' failed: ' + response.status);
    return data;
  };
  const proxy = async route => {
    try { const response = await route.fetch({ url: base + new URL(route.request().url()).pathname }); await route.fulfill({ response }); }
    catch (error) { if (!/disposed|closed|aborted|cancelled/i.test(error.message)) throw error; await route.abort().catch(() => {}); }
  };
  const newContext = async token => {
    const context = await browser.newContext({ timezoneId: 'Asia/Kolkata', viewport: { width: 1280, height: 800 } });
    if (token) await context.addInitScript(value => localStorage.setItem('evently_token', value), token);
    await context.route('http://localhost:5000/api/**', proxy);
    return context;
  };
  const ready = async page => {
    await expect(page.locator('main')).toBeVisible();
    await page.waitForFunction(() => !document.body.innerText.includes('Loading'), { timeout: 45000 });
    await expect(page.locator('main')).not.toContainText(/Oops!|Failed to load|Unable to load|Failed to fetch|Unable to verify|Quote not found/);
  };
  try {
    const vendor = await prisma.user.create({ data: { email: 'workflow-browser-' + stamp + '-vendor@example.test', password: passwordHash, role: 'VENDOR', vendorProfile: { create: { businessName: 'Browser Test Vendor', city: 'Pune' } } }, include: { vendorProfile: true } });
    accounts.push(vendor);
    const org = await prisma.user.create({ data: { email: 'workflow-browser-' + stamp + '-org@example.test', password: passwordHash, role: 'ORGANIZER', organizerProfile: { create: { firstName: 'Browser', lastName: 'Organizer' } } }, include: { organizerProfile: true } });
    accounts.push(org);
    await prisma.$transaction(async tx => {
      await tx.event.createMany({ data: ids.map((id, i) => ({ id: id.event, organizerId: org.organizerProfile.id, title: 'Browser Event ' + i, date: new Date('2035-01-' + (10 + i) + 'T10:00:00Z'), location: 'Pune' })) });
      await tx.vendorInquiry.createMany({ data: ids.map(id => ({ id: id.inquiry, eventId: id.event, vendorId: vendor.vendorProfile.id, message: 'Please quote', status: 'RESPONDED' })) });
      await tx.quote.createMany({ data: ids.map(id => ({ id: id.quote, inquiryId: id.inquiry, vendorId: vendor.vendorProfile.id, details: 'Photography coverage', totalAmount: 100, status: 'ACCEPTED' })) });
      await tx.booking.createMany({ data: ids.map(id => ({ id: id.booking, eventId: id.event, quoteId: id.quote })) });
      await tx.budget.create({ data: { eventId: ids[0].event, organizerId: org.organizerProfile.id, totalBudget: 2000 } });
      await tx.shortlist.create({ data: { eventId: ids[0].event, organizerId: org.organizerProfile.id, vendorId: vendor.vendorProfile.id } });
      await tx.eventRequirement.create({ data: { eventId: ids[0].event, title: 'Photography' } });
      await tx.notification.create({ data: { userId: org.id, title: 'Inquiry Sent', content: 'Inquiry sent to vendor', inquiryId: ids[0].inquiry, eventId: ids[0].event } });
      await tx.message.create({ data: { senderId: org.id, receiverId: vendor.id, content: 'Browser test message' } });
      await tx.review.create({ data: { vendorId: vendor.vendorProfile.id, organizerId: org.organizerProfile.id, rating: 5, comment: 'Great service' } });
    }, { timeout: 60000 });
    const orgToken = jwt.sign({ id: org.id, role: org.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const vendorToken = jwt.sign({ id: vendor.id, role: vendor.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const outsider = await prisma.user.create({ data: { email: 'workflow-browser-' + stamp + '-outsider@example.test', password: passwordHash, role: 'ORGANIZER', organizerProfile: { create: { firstName: 'Unconnected', lastName: 'Organizer' } } } });
    accounts.push(outsider);
    const outsiderToken = jwt.sign({ id: outsider.id, role: outsider.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    for (const method of ['GET', 'POST']) {
      const response = await fetch(base + '/api/messages/' + vendor.id, { method, headers: { Authorization: 'Bearer ' + outsiderToken, 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: JSON.stringify({ content: 'Forbidden' }) } : {}) });
      assert.equal(response.status, 404, 'Unconnected accounts must not access conversations');
    }
    assert.equal((await api(outsiderToken, 'GET', 'messages/conversations')).length, 0);
    assert.equal((await api(orgToken, 'GET', 'messages/' + vendor.id)).length, 1);
    const sent = await api(vendorToken, 'POST', 'messages/' + org.id, { content: 'Browser vendor reply' });
    assert.equal(sent.senderId, vendor.id);
    assert.equal((await api(orgToken, 'GET', 'messages/' + vendor.id)).length, 2);
    console.log('Messaging access, privacy, and sending checks passed.');
    browser = await chromium.launch({ headless: true });
    const errors = [];
    const publicContext = await newContext();
    const pp = await publicContext.newPage();
    pp.on('pageerror', error => errors.push(error.message));
    for (const route of ['/', '/register', '/find-vendors', '/vendor/' + vendor.vendorProfile.id]) {
      await pp.goto(client + route);
      await pp.waitForFunction(() => !document.body.innerText.includes('Loading'));
      await expect(pp.locator('body')).not.toContainText(/Failed to load|Vendor not found/);
      console.log('Public page passed: ' + route);
    }
    await pp.goto(client + '/login');
    await pp.getByPlaceholder('Enter your email').fill(org.email);
    await pp.getByPlaceholder('Enter your password').fill(password);
    await pp.getByRole('button', { name: 'Log In', exact: true }).click();
    await pp.waitForURL('**/organizer/dashboard');
    await ready(pp);
    console.log('Browser login passed.');
    await publicContext.unrouteAll({ behavior: 'ignoreErrors' }); await publicContext.close();
    const context = await newContext(orgToken);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    let eventReads = 0;
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/events' && request.method() === 'GET') eventReads++; });
    await page.goto(client + '/organizer/events'); await ready(page);
    const readsBeforeRevisit = eventReads;
    await page.getByRole('link', { name: 'Bookings', exact: true }).click();
    await page.waitForURL('**/organizer/bookings'); await ready(page);
    const revisitStart = performance.now();
    await page.getByRole('link', { name: 'My Events', exact: true }).click();
    await page.waitForURL('**/organizer/events'); await ready(page);
    assert.equal(eventReads, readsBeforeRevisit, 'Revisiting a recent module should reuse data without another request');
    console.log('Cached module revisit: ' + Math.round(performance.now() - revisitStart) + 'ms; no extra events request.');
    // Hold a refresh response to prove focus and expired cache do not block navigation.
    const snapshot = await api(orgToken, 'GET', 'events');
    let releaseRefresh;
    const refreshGate = new Promise(resolve => { releaseRefresh = resolve; });
    const refreshHandler = async route => {
      await refreshGate;
      const changed = snapshot.map(event => event.id === ids[0].event ? { ...event, title: 'Background refreshed event' } : event);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(changed) });
    };
    await page.route('**/api/events', refreshHandler);
    try {
      await page.getByRole('link', { name: 'Bookings', exact: true }).click();
      await page.waitForURL('**/organizer/bookings'); await ready(page);
      await page.evaluate(() => { window.dispatchEvent(new Event('focus')); });
      const staleStart = performance.now();
      await page.getByRole('link', { name: 'My Events', exact: true }).click();
      await page.waitForURL('**/organizer/events'); await ready(page);
      await expect(page.getByText('Browser Event 0', { exact: true })).toBeVisible();
      console.log('Stale module revisit while refresh is held: ' + Math.round(performance.now() - staleStart) + 'ms.');
      releaseRefresh();
      await expect(page.getByText('Background refreshed event', { exact: true })).toBeVisible();
      console.log('Background refresh updated the visible module without blocking navigation.');
    } finally { releaseRefresh(); await page.unroute('**/api/events', refreshHandler); }
    for (const route of ['dashboard','events','events/' + ids[0].event,'vendors','vendors/' + vendor.vendorProfile.id,'shortlist','compare','requests','quotes','quotes/' + ids[0].quote,'bookings','bookings/' + ids[0].booking,'messages','budget','notifications','profile','settings']) {
      await page.goto(client + '/organizer/' + route); await ready(page); console.log('Organizer page passed: ' + route);
    }
    await page.goto(client + '/organizer/events/' + ids[0].event + '/edit');
    await expect(page.locator('input[name="date"]')).toHaveValue('2035-01-10T15:30');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await page.waitForURL('**/organizer/events/' + ids[0].event); await ready(page);
    assert.equal((await api(orgToken, 'GET', 'events/' + ids[0].event)).date, '2035-01-10T10:00:00.000Z');
    await page.getByLabel('Requirement title').fill('Browser requirement');
    await page.getByRole('button', { name: 'Add Requirement', exact: true }).click();
    await expect(page.getByText('Browser requirement', { exact: true })).toBeVisible();
    await page.goto(client + '/organizer/notifications'); await ready(page);
    await page.locator('.card').filter({ hasText: 'Inquiry Sent' }).first().click();
    await page.waitForURL('**/organizer/requests'); await ready(page);
    await page.getByRole('link', { name: /^Notifications/ }).last().click();
    await page.waitForURL('**/organizer/notifications'); await ready(page);
    console.log('Event time, requirement creation, inquiry notification, and notification bell passed.');
    const vc = await newContext(vendorToken);
    const vp = await vc.newPage();
    vp.on('pageerror', error => errors.push(error.message));
    for (const route of ['dashboard','profile','services','packages','availability','requests','quotes','quotes/' + ids[0].quote,'bookings','bookings/' + ids[0].booking,'messages','reviews','earnings','notifications','settings']) {
      await vp.goto(client + '/vendor/' + route); await ready(vp); console.log('Vendor page passed: ' + route);
    }
    await vp.goto(client + '/vendor/messages'); await ready(vp);
    const conversationSnapshot = await api(vendorToken, 'GET', 'messages/conversations');
    let releaseChat;
    const chatGate = new Promise(resolve => { releaseChat = resolve; });
    const heldChat = async route => {
      await chatGate;
      const changed = conversationSnapshot.map((conversation, index) => index ? conversation : { ...conversation, lastMessage: { ...conversation.lastMessage, content: 'Live incoming message' } });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(changed) });
    };
    await vp.getByRole('link', { name: 'Services', exact: true }).click();
    await vp.waitForURL('**/vendor/services'); await ready(vp);
    await vp.route('**/api/messages/conversations', heldChat);
    try {
      const chatStart = performance.now();
      await vp.getByRole('link', { name: 'Messages', exact: true }).click();
      await vp.waitForURL('**/vendor/messages'); await ready(vp);
      await expect(vp.getByText('You: Browser vendor reply', { exact: true })).toBeVisible();
      console.log('Vendor Messages revisit with a held refresh: ' + Math.round(performance.now() - chatStart) + 'ms.');
      releaseChat();
      await expect(vp.getByText('You: Live incoming message', { exact: true })).toBeVisible();
    } finally { releaseChat(); await vp.unroute('**/api/messages/conversations', heldChat); }
    await vp.goto(client + '/vendor/earnings'); await ready(vp);
    await expect(vp.getByText('₹700', { exact: true }).first()).toBeVisible();
    assert.equal((await api(vendorToken, 'GET', 'vendor-dashboard')).earningsBookings.length, 7);
    assert.deepEqual(errors, []);
    console.log('All browser page checks passed without uncaught application errors.');
  } finally {
    if (browser) { for (const context of browser.contexts()) await context.unrouteAll({ behavior: 'ignoreErrors' }); await browser.close(); }
    for (const account of accounts.reverse()) {
      const current = await prisma.user.findUnique({ where: { id: account.id }, select: { email: true } });
      if (current?.email.startsWith('workflow-browser-' + stamp)) await prisma.$transaction(tx => deleteAccountData(tx, account.id), { timeout: 90000 });
    }
    await new Promise(resolve => http.close(resolve));
    await prisma.$disconnect();
  }
});
