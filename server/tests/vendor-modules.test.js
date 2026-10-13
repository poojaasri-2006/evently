const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');
const { createServer } = require('http');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config({ quiet: true });
const prisma = require('../src/utils/prisma');
const app = require('../src/app');
const { deleteAccountData } = require('../src/utils/deleteAccountData');
const { dateKey } = require('../src/utils/bookingAvailability');
const { chromium, expect: baseExpect } = require('@playwright/test');
const expect = baseExpect.configure({ timeout: 30000 });

test('vendor actions, isolated permissions, exact results, and browser interactions', { timeout: 600000 }, async () => {
  const stamp = randomUUID();
  const accounts = [];
  let browser, uploadedPath;
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let checks = 0;
  const api = async (actor, method, endpoint, body, status = 200) => {
    const response = await fetch(base + '/api/' + endpoint, { method, headers: { Authorization: 'Bearer ' + actor.token, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    assert.equal(response.status, status, method + ' ' + endpoint + ': ' + JSON.stringify(data));
    checks++; return data;
  };
  const createAccount = async (role, label) => {
    const password = 'VendorAudit123!';
    const actor = await prisma.user.create({ data: { email: 'workflow-vendor-audit-' + stamp + '-' + label + '@example.test', password: await bcrypt.hash(password, 10), role,
      ...(role === 'VENDOR' ? { vendorProfile: { create: { businessName: 'Audit Vendor ' + label, city: 'Pune' } } } : { organizerProfile: { create: { firstName: 'Audit', lastName: label } } }) }, include: { vendorProfile: true, organizerProfile: true } });
    accounts.push(actor);
    actor.token = jwt.sign({ id: actor.id, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    actor.plainPassword = password; return actor;
  };
  try {
    const vendor = await createAccount('VENDOR', 'main');
    const outsider = await createAccount('VENDOR', 'outsider');
    const org = await createAccount('ORGANIZER', 'organizer');
    const reviewer = await createAccount('ORGANIZER', 'reviewer');
    const future = new Date(Date.now() + 7 * 86400000);
    const past = new Date(Date.now() - 7 * 86400000);
    const scenarios = [
      { date: past, status: 'CONFIRMED', amount: 100.25 },
      { date: future, status: 'CONFIRMED', amount: 200.75 },
      { date: past, status: 'COMPLETED', amount: 50.5 },
      { date: future, status: 'CANCELLED', amount: 999 },
      { date: null, status: 'CONFIRMED', amount: 25 }
    ];
    const fixtures = [];
    await prisma.$transaction(async tx => {
      for (const [index, scenario] of scenarios.entries()) {
        const event = await tx.event.create({ data: { organizerId: org.organizerProfile.id, title: 'Audit booking ' + index, date: scenario.date } });
        const inquiry = await tx.vendorInquiry.create({ data: { eventId: event.id, vendorId: vendor.vendorProfile.id, message: 'Audit request', status: 'RESPONDED' } });
        const quote = await tx.quote.create({ data: { inquiryId: inquiry.id, vendorId: vendor.vendorProfile.id, details: 'Audit coverage', totalAmount: scenario.amount, status: 'ACCEPTED' } });
        const booking = await tx.booking.create({ data: { eventId: event.id, quoteId: quote.id, status: scenario.status } });
        fixtures.push({ event, inquiry, quote, booking });
      }
      await tx.review.createMany({ data: [{ vendorId: vendor.vendorProfile.id, organizerId: org.organizerProfile.id, rating: 5, comment: 'Excellent audit service' }, { vendorId: vendor.vendorProfile.id, organizerId: reviewer.organizerProfile.id, rating: 3, comment: 'Average audit service' }] });
      await tx.notification.create({ data: { userId: vendor.id, title: 'Audit notice', content: 'Vendor audit notification' } });
    }, { timeout: 90000 });
    let report = await api(vendor, 'GET', 'vendor-dashboard');
    assert.equal(report.stats.upcomingBookingsCount, 1);
    assert.equal(report.upcomingBookings.length, 1);
    assert.equal(report.stats.totalEarnings, 376.5);
    assert.equal(report.earningsBookings.length, 4);
    assert.equal(report.earningsBookings.reduce((sum, b) => sum + b.amount, 0), 376.5);
    const empty = await api(outsider, 'GET', 'vendor-dashboard');
    assert.equal(empty.stats.totalEarnings, 0); assert.equal(empty.stats.upcomingBookingsCount, 0);
    assert.deepEqual(await api(outsider, 'GET', 'vendor/bookings'), []);
    assert.equal((await api(vendor, 'GET', 'vendor/bookings')).length, 5);
    assert.equal((await api(vendor, 'GET', 'vendor/bookings/' + fixtures[0].booking.id)).quote.totalAmount, 100.25);
    await api(outsider, 'GET', 'vendor/bookings/' + fixtures[0].booking.id, undefined, 404);
    console.log('Dashboard counts, past/future bookings, cancellation exclusion, and exact earnings passed.');

    const service = await api(vendor, 'POST', 'vendor/services', { name: 'Audit photography', price: 125.5, pricingType: 'HOURLY' }, 201);
    assert.equal(service.price, 125.5);
    assert.equal((await api(vendor, 'PATCH', 'vendor/services/' + service.id, { price: 234.75 })).price, 234.75);
    await api(outsider, 'PATCH', 'vendor/services/' + service.id, { price: 1 }, 404);
    await api(outsider, 'DELETE', 'vendor/services/' + service.id, undefined, 404);
    await api(vendor, 'POST', 'vendor/services', { name: 'Invalid', price: -1 }, 400);
    const foreign = await api(outsider, 'POST', 'vendor/services', { name: 'Foreign', price: 1 }, 201);
    await api(vendor, 'POST', 'vendor/packages', { name: 'Foreign package', price: 10, serviceIds: [foreign.id] }, 403);
    const pkg = await api(vendor, 'POST', 'vendor/packages', { name: 'Audit package', price: 500.25, serviceIds: [service.id] }, 201);
    assert.equal(pkg.services.length, 1);
    assert.equal((await api(vendor, 'PATCH', 'vendor/packages/' + pkg.id, { price: 600.5, serviceIds: [] })).services.length, 0);
    await api(outsider, 'PATCH', 'vendor/packages/' + pkg.id, { price: 1 }, 404);
    await api(outsider, 'DELETE', 'vendor/packages/' + pkg.id, undefined, 404);
    await api(vendor, 'POST', 'vendor/packages', { name: 'Invalid', price: -1 }, 400);
    assert((await api(vendor, 'GET', 'vendor/services')).some(s => s.id === service.id));
    assert((await api(vendor, 'GET', 'vendor/packages')).some(p => p.id === pkg.id && p.price === 600.5));
    console.log('Services and packages create/edit/list and ownership checks passed.');

    const freeDay = dateKey(new Date(Date.now() + 30 * 86400000));
    const availability = await api(vendor, 'POST', 'vendor/availability', { date: freeDay, isBlocked: true, reason: 'Audit block' }, 201);
    await api(vendor, 'POST', 'vendor/availability', { date: dateKey(future), isBlocked: true }, 409);
    await api(vendor, 'POST', 'vendor/availability', { date: '2035-02-30', isBlocked: true }, 400);
    await api(vendor, 'PATCH', 'vendor/availability/' + availability.entry.id, { startTime: '18:00', endTime: '09:00' }, 400);
    await api(outsider, 'PATCH', 'vendor/availability/' + availability.entry.id, { isBlocked: false }, 404);
    await api(outsider, 'DELETE', 'vendor/availability/' + availability.entry.id, undefined, 404);
    assert.equal((await api(vendor, 'PATCH', 'vendor/availability/' + availability.entry.id, { isBlocked: false, startTime: '09:00', endTime: '18:00' })).isBlocked, false);
    const calendar = await api(vendor, 'GET', 'vendor/availability');
    assert.equal(calendar.availability[0].date.slice(0, 10), freeDay);
    assert.equal(calendar.bookings.length, 4);
    await api(vendor, 'DELETE', 'vendor/availability/' + availability.entry.id);
    assert.equal((await api(vendor, 'GET', 'vendor/availability')).availability.length, 0);
    console.log('Calendar CRUD, booking conflicts, date validation, and ownership passed.');

    const event = await api(org, 'POST', 'events', { name: 'Audit pending event', date: new Date(Date.now() + 40 * 86400000).toISOString() }, 201);
    const inquiry = await api(org, 'POST', 'inquiries', { eventId: event.id, vendorId: vendor.vendorProfile.id, message: 'Audit quote request' }, 201);
    await api(outsider, 'GET', 'vendor/requests/' + inquiry.id, undefined, 404);
    await api(vendor, 'PATCH', 'vendor/requests/' + inquiry.id + '/status', { status: 'ACCEPTED' });
    const quote = await api(vendor, 'POST', 'quotes', { inquiryId: inquiry.id, totalAmount: 125.75, details: 'Audit pending coverage' }, 201);
    await api(vendor, 'POST', 'quotes', { inquiryId: inquiry.id, totalAmount: 125, details: 'Duplicate' }, 409);
    await api(outsider, 'PATCH', 'quotes/' + quote.id, { totalAmount: 1 }, 404);
    await api(vendor, 'PATCH', 'quotes/' + quote.id, { totalAmount: 0 }, 400);
    assert.equal((await api(vendor, 'PATCH', 'quotes/' + quote.id, { totalAmount: 128.25, details: 'Updated pending coverage' })).totalAmount, 128.25);
    await api(vendor, 'PATCH', 'quotes/' + fixtures[0].quote.id, { totalAmount: 1 }, 400);
    assert.equal((await api(vendor, 'GET', 'vendor/requests/' + inquiry.id)).quote.totalAmount, 128.25);
    await api(vendor, 'PATCH', 'vendor/requests/' + fixtures[0].inquiry.id + '/status', { status: 'DECLINED' }, 409);
    assert((await api(org, 'GET', 'notifications')).some(n => n.quoteId === quote.id && n.content.includes('\u20b9')));
    const declined = await api(org, 'POST', 'inquiries', { eventId: event.id, vendorId: vendor.vendorProfile.id, message: 'Decline this' }, 201);
    await api(vendor, 'PATCH', 'vendor/requests/' + declined.id + '/status', { status: 'DECLINED' });
    await api(vendor, 'PATCH', 'vendor/requests/' + declined.id + '/status', { status: 'PENDING' }, 400);
    await api(vendor, 'POST', 'quotes', { inquiryId: declined.id, totalAmount: 20, details: 'Forbidden' }, 400);
    console.log('Requests, quotes, editing, terminal states, and rupee notifications passed.');

    const profile = await api(vendor, 'PATCH', 'profile/vendor', { businessName: 'Updated Audit Business', city: 'Mumbai', description: 'Audit profile', phone: '9876543210', website: 'https://example.test' });
    assert.equal(profile.city, 'Mumbai');
    assert.equal((await api(vendor, 'GET', 'profile')).vendorProfile.businessName, 'Updated Audit Business');
    const image = new FormData();
    image.append('image', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1sAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'audit.png');
    const uploaded = await fetch(base + '/api/profile/vendor/image', { method: 'POST', headers: { Authorization: 'Bearer ' + vendor.token }, body: image });
    assert.equal(uploaded.status, 200);
    const upload = await uploaded.json();
    const filename = path.basename(new URL(upload.imageUrl).pathname);
    assert(filename.startsWith('vendor-' + vendor.id + '-'));
    uploadedPath = path.resolve(__dirname, '../uploads/profiles', filename);
    assert(uploadedPath.startsWith(path.resolve(__dirname, '../uploads/profiles') + path.sep));
    assert.equal((await fetch(upload.imageUrl)).status, 200);
    assert.equal((await api(vendor, 'GET', 'profile')).vendorProfile.imageUrl, upload.imageUrl);
    const reviews = (await api(vendor, 'GET', 'vendors/' + vendor.vendorProfile.id)).reviews;
    assert.equal(reviews.length, 2); assert.equal(reviews.reduce((sum,r) => sum + r.rating, 0) / reviews.length, 4);
    await api(vendor, 'POST', 'messages/' + org.id, { content: 'Audit vendor message' }, 201);
    assert.equal((await api(org, 'GET', 'messages/' + vendor.id))[0].content, 'Audit vendor message');
    await api(outsider, 'GET', 'messages/' + org.id, undefined, 404);
    const notices = await api(vendor, 'GET', 'notifications');
    await api(outsider, 'PATCH', 'notifications/' + notices[0].id + '/read', {}, 403);
    await api(vendor, 'PATCH', 'notifications/' + notices[0].id + '/read', {});
    await api(vendor, 'PATCH', 'notifications/read-all', {});
    assert.equal((await api(vendor, 'GET', 'notifications/unread-count')).count, 0);
    const prefs = await api(vendor, 'PATCH', 'profile/notification-preferences', { eventUpdates: false, vendorActivity: false, quotesAndBookings: false, generalSystem: false });
    assert.equal(prefs.quotesAndBookings, false);
    assert.equal((await api(vendor, 'GET', 'profile/notification-preferences')).generalSystem, false);
    console.log('Profile, image upload, reviews, messaging, notification receipts, and settings passed.');

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ timezoneId: 'Asia/Kolkata' });
    await context.addInitScript(token => localStorage.setItem('evently_token', token), vendor.token);
    await context.route('http://localhost:5000/api/**', async route => {
      try { const response = await route.fetch({ url: base + new URL(route.request().url()).pathname }); await route.fulfill({ response }); }
      catch(error) { if (!/disposed|closed|aborted|cancelled/i.test(error.message)) throw error; await route.abort().catch(() => {}); }
    });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const client = process.env.TEST_CLIENT_URL || 'http://localhost:5173';
    await page.goto(client + '/vendor/earnings');
    await expect(page.getByText('\u20b994.13', { exact: true })).toBeVisible();
    await page.goto(client + '/vendor/reviews');
    await expect(page.getByText('4.0', { exact: true })).toBeVisible();
    await expect(page.getByText('2 reviews', { exact: true })).toBeVisible();
    await page.goto(client + '/vendor/quotes/' + quote.id);
    await expect(page.getByPlaceholder('e.g. 2500.00')).toHaveValue('128.25');
    await page.getByRole('link', { name: 'Quotes', exact: true }).click();
    await expect(page.getByPlaceholder('Search quotes by event or details...')).toBeVisible();
    await page.goto(client + '/vendor/quotes/missing-audit-quote');
    await expect(page.getByText('Quote not found', { exact: true })).toBeVisible();
    await page.goto(client + '/vendor/services');
    await page.getByRole('button', { name: 'Add Service', exact: true }).click();
    await page.getByPlaceholder('e.g., Wedding Photography').fill('Browser audit service');
    await page.locator('form input[type=number]').fill('75.25');
    await page.locator('form button[type=submit]').click();
    await expect(page.getByText('Browser audit service', { exact: true })).toBeVisible();
    assert((await api(vendor, 'GET', 'vendor/services')).some(s => s.name === 'Browser audit service' && s.price === 75.25));
    await page.goto(client + '/vendor/packages');
    await page.getByRole('button', { name: 'Add Package', exact: true }).click();
    await page.getByPlaceholder('e.g., Complete Wedding Photography & Video Bundle').fill('Browser audit package');
    await page.getByPlaceholder('Total package price').fill('400.75');
    await page.locator('form button[type=submit]').click();
    await expect(page.getByText('Browser audit package', { exact: true })).toBeVisible();
    assert((await api(vendor, 'GET', 'vendor/packages')).some(p => p.name === 'Browser audit package' && p.price === 400.75));
    assert.deepEqual(errors, []);
    await context.unrouteAll({ behavior: 'ignoreErrors' }); await browser.close(); browser = null;
    console.log('Browser earnings precision, review results, quote navigation, and catalog creation passed.');

    await api(vendor, 'DELETE', 'vendor/packages/' + pkg.id);
    await api(vendor, 'DELETE', 'vendor/services/' + service.id);
    await api(vendor, 'POST', 'profile/password', { currentPassword: 'wrong', newPassword: 'NewVendorAudit123!' }, 400);
    await api(vendor, 'POST', 'profile/password', { currentPassword: vendor.plainPassword, newPassword: 'NewVendorAudit123!' });
    await api(vendor, 'POST', 'auth/login', { email: vendor.email, password: vendor.plainPassword }, 401);
    assert((await api(vendor, 'POST', 'auth/login', { email: vendor.email, password: 'NewVendorAudit123!' })).token);
    await api(vendor, 'POST', 'profile/delete-account', { password: 'wrong' }, 400);
    await api(vendor, 'POST', 'profile/delete-account', { password: 'NewVendorAudit123!' });
    await api(vendor, 'GET', 'auth/me', undefined, 401);
    assert.equal(await prisma.vendorProfile.count({ where: { id: vendor.vendorProfile.id } }), 0);
    assert.equal(await prisma.user.count({ where: { id: org.id } }), 1);
    console.log('Password update, login verification, account deletion, and surviving organizer passed. Total API checks: ' + checks);
  } finally {
    if (browser) { for (const context of browser.contexts()) await context.unrouteAll({ behavior: 'ignoreErrors' }); await browser.close(); }
    if (uploadedPath && fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
    for (const actor of accounts.reverse()) {
      const current = await prisma.user.findUnique({ where: { id: actor.id } });
      if (current?.email.startsWith('workflow-vendor-audit-' + stamp)) await prisma.$transaction(tx => deleteAccountData(tx, actor.id), { timeout: 90000 });
    }
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
});
