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

test('organizer actions, isolated permissions, exact results, and browser interactions', { timeout: 600000 }, async () => {
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
    const actor = await prisma.user.create({ data: { email: 'workflow-organizer-audit-' + stamp + '-' + label + '@example.test', password: await bcrypt.hash(password, 10), role,
      ...(role === 'VENDOR' ? { vendorProfile: { create: { businessName: 'Audit Vendor ' + label, city: 'Pune' } } } : { organizerProfile: { create: { firstName: 'Audit', lastName: label } } }) }, include: { vendorProfile: true, organizerProfile: true } });
    accounts.push(actor);
    actor.token = jwt.sign({ id: actor.id, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    actor.plainPassword = password; return actor;
  };
  try {
    const org = await createAccount('ORGANIZER', 'main');
    const outsider = await createAccount('ORGANIZER', 'outsider');
    const vendor = await createAccount('VENDOR', 'A');
    const secondVendor = await createAccount('VENDOR', 'B');
    const event = await api(org, 'POST', 'events', { name: 'Organizer audit event', date: '2035-03-10T10:00:00Z', location: 'Pune', budget: 1000.25 }, 201);
    const second = await api(org, 'POST', 'events', { name: 'Second organizer audit event', date: '2035-03-11T10:00:00Z' }, 201);
    await api(outsider, 'GET', 'events/' + event.id, undefined, 403);
    await api(outsider, 'PATCH', 'events/' + event.id, { title: 'Forbidden' }, 403);
    assert.equal((await api(org, 'PATCH', 'events/' + event.id, { title: 'Updated organizer audit event', location: 'Mumbai' })).location, 'Mumbai');
    const requirement = await api(org, 'POST', 'events/' + event.id + '/requirements', { title: 'Audit requirement', category: 'Photography' }, 201);
    await api(outsider, 'PATCH', 'events/' + event.id + '/requirements/' + requirement.id, { status: 'COMPLETED' }, 403);
    await api(org, 'PATCH', 'events/' + event.id + '/requirements/' + requirement.id, { status: 'COMPLETED' });
    const shortlist = await api(org, 'POST', 'shortlist', { eventId: event.id, vendorId: vendor.vendorProfile.id }, 201);
    await api(org, 'POST', 'shortlist', { eventId: event.id, vendorId: secondVendor.vendorProfile.id }, 201);
    await api(org, 'POST', 'shortlist', { eventId: event.id, vendorId: vendor.vendorProfile.id }, 409);
    await api(outsider, 'DELETE', 'shortlist/' + shortlist.id, undefined, 403);
    await api(vendor, 'POST', 'vendor/services', { name: 'Free consultation', price: 0 }, 201);
    await api(vendor, 'POST', 'vendor/packages', { name: 'Organizer audit package', price: 100 }, 201);
    await api(secondVendor, 'POST', 'vendor/services', { name: 'Paid consultation', price: 50 }, 201);
    const inquiry = await api(org, 'POST', 'inquiries', { eventId: event.id, vendorId: vendor.vendorProfile.id, message: 'Audit inquiry' }, 201);
    const quote = await api(vendor, 'POST', 'quotes', { inquiryId: inquiry.id, details: 'Organizer audit scope', totalAmount: 200.5 }, 201);
    await api(outsider, 'GET', 'quotes/' + quote.id, undefined, 404);
    await api(outsider, 'PATCH', 'quotes/' + quote.id + '/status', { status: 'ACCEPTED' }, 403);
    const decision = await api(org, 'PATCH', 'quotes/' + quote.id + '/status', { status: 'ACCEPTED' });
    assert.equal((await api(org, 'GET', 'bookings/' + decision.booking.id)).quote.totalAmount, 200.5);
    await api(outsider, 'GET', 'bookings/' + decision.booking.id, undefined, 404);
    const item = await api(org, 'POST', 'events/' + event.id + '/budget/items', { category: 'Extras', amount: 50.25 }, 201);
    let budget = await api(org, 'GET', 'events/' + event.id + '/budget');
    assert.equal(budget.confirmedBookingTotal, 200.5); assert.equal(budget.totalAllocated, 250.75); assert.equal(budget.remainingBudget, 749.5);
    await api(outsider, 'GET', 'events/' + event.id + '/budget', undefined, 403);
    await api(outsider, 'POST', 'events/' + event.id + '/budget/items', { category: 'Forbidden', amount: 1 }, 403);
    for (const value of [null, '', -1]) await api(org, 'POST', 'events/' + event.id + '/budget', { totalBudget: value }, 400);
    await api(org, 'POST', 'events/' + event.id + '/budget/items', { category: 'Invalid', amount: null }, 400);
    await Promise.all([10.25,20.5].map(amount => api(org, 'POST', 'events/' + second.id + '/budget/items', { category: 'Concurrent extras', amount }, 201)));
    assert.equal((await api(org, 'GET', 'events/' + second.id + '/budget')).totalAllocated, 30.75);
    await api(org, 'POST', 'events/' + second.id + '/budget', { totalBudget: 111 });
    await api(org, 'PATCH', 'bookings/' + decision.booking.id + '/status', { status: 'COMPLETED' });
    assert.equal((await api(org, 'GET', 'events/' + event.id + '/budget')).confirmedBookingTotal, 200.5);
    await api(org, 'PATCH', 'bookings/' + decision.booking.id + '/status', { status: 'CANCELLED' }, 409);
    await api(org, 'POST', 'reviews', { vendorId: vendor.vendorProfile.id, rating: 5, comment: 'Organizer audit review' }, 201);
    await api(org, 'POST', 'reviews', { vendorId: vendor.vendorProfile.id, rating: 4 }, 409);
    await api(outsider, 'POST', 'reviews', { vendorId: vendor.vendorProfile.id, rating: 5 }, 403);
    const pending = await api(org, 'POST', 'inquiries', { eventId: second.id, vendorId: secondVendor.vendorProfile.id, message: 'Cancel request' }, 201);
    await api(outsider, 'PATCH', 'inquiries/' + pending.id + '/cancel', {}, 403);
    assert.equal((await api(org, 'PATCH', 'inquiries/' + pending.id + '/cancel', {})).status, 'CANCELLED');
    await api(org, 'POST', 'messages/' + vendor.id, { content: 'Organizer audit message' }, 201);
    assert.equal((await api(vendor, 'GET', 'messages/' + org.id))[0].content, 'Organizer audit message');
    await api(outsider, 'GET', 'messages/' + vendor.id, undefined, 404);
    const notices = await api(org, 'GET', 'notifications');
    await api(outsider, 'PATCH', 'notifications/' + notices[0].id + '/read', {}, 403);
    await api(org, 'PATCH', 'notifications/read-all', {});
    assert.equal((await api(org, 'GET', 'notifications/unread-count')).count, 0);
    await api(org, 'PATCH', 'profile/notification-preferences', { eventUpdates: false, generalSystem: false });
    assert.equal((await api(org, 'GET', 'profile/notification-preferences')).eventUpdates, false);
    console.log('Organizer events, requirements, shortlist, quote decisions, booking states, budgets, reviews, messages, notifications, and ownership passed.');

    if (process.env.SKIP_BROWSER !== '1') {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ timezoneId: 'Asia/Kolkata' });
    await context.addInitScript(token => localStorage.setItem('evently_token', token), org.token);
    await context.route('http://localhost:5000/api/**', async route => {
      try { const response = await route.fetch({ url: base + new URL(route.request().url()).pathname }); await route.fulfill({ response }); }
      catch(error) { if (!/disposed|closed|aborted|cancelled/i.test(error.message)) throw error; await route.abort().catch(() => {}); }
    });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const client = process.env.TEST_CLIENT_URL || 'http://localhost:5173';
    const ready = async () => { await page.waitForFunction(() => !document.body.innerText.includes('Loading...')); await expect(page.locator('main')).not.toContainText(/Failed to load|Unable to load|Oops!/); };
    for(const route of ['dashboard','events','events/' + event.id,'vendors','vendors/' + vendor.vendorProfile.id,'shortlist','compare','requests','quotes','quotes/' + quote.id,'bookings','bookings/' + decision.booking.id,'messages','budget','notifications','profile','settings']){
      await page.goto(client + '/organizer/' + route); await ready(); console.log('Organizer page checked: ' + route);
    }
    await page.goto(client + '/organizer/vendors'); await ready();
    await page.getByPlaceholder('Search vendors by name or category...').fill('Audit Vendor');
    await page.locator('select').last().selectOption('Price: Low to High');
    await expect(page.locator('main .card').filter({ hasText: 'Audit Vendor A' }).getByText(/Starting at:.*0/)).toBeVisible();
    const names = await page.locator('main .card h3').allTextContents();
    assert(names.indexOf('Audit Vendor A') < names.indexOf('Audit Vendor B'), 'Free-price vendor must sort first');
    await page.goto(client + '/organizer/compare'); await ready();
    await page.getByText('Select up to 3 more vendors...', { exact: true }).click();
    await page.getByText('Audit Vendor A', { exact: true }).click();
    await page.getByText('Select up to 2 more vendors...', { exact: true }).click();
    await page.getByText('Audit Vendor B', { exact: true }).click();
    await expect(page.getByText('\u20b90', { exact: true })).toBeVisible();
    await expect(page.getByText('Organizer audit package (\u20b9100)', { exact: true })).toBeVisible();
    await page.goto(client + '/organizer/profile'); await ready();
    await page.locator('form input[type=text]').first().fill('UpdatedOrganizer');
    await page.locator('form button[type=submit]').click();
    await expect(page.getByText('Profile updated successfully!', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click(); await ready();
    await expect(page.getByRole('heading', { name: /UpdatedOrganizer/ })).toBeVisible();

    const snapshot = await api(org, 'GET', 'events/' + event.id + '/budget');
    let release; const gate = new Promise(resolve => { release = resolve; });
    const held = async route => { await gate; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshot) }); };
    await page.route('**/api/events/' + event.id + '/budget', held);
    try {
      await page.goto(client + '/organizer/budget');
      await expect(page.locator('select')).toHaveValue(event.id);
      await page.locator('select').selectOption(second.id);
      await expect(page.getByRole('heading', { name: '\u20b9111', exact: true })).toBeVisible();
      release(); await page.waitForTimeout(200);
      await expect(page.getByRole('heading', { name: '\u20b9111', exact: true })).toBeVisible();
      await expect(page.locator('select')).toHaveValue(second.id);
    } finally { release(); await page.unroute('**/api/events/' + event.id + '/budget', held); }
    assert.deepEqual(errors, []);
    await context.unrouteAll({ behavior: 'ignoreErrors' }); await browser.close(); browser = null;
    console.log('Organizer browser pages, free-price sorting, comparison, profile synchronization, and delayed budget response checks passed.');
    }
    await api(org, 'DELETE', 'events/' + event.id + '/budget/items/' + item.id);
    assert.equal((await api(org, 'GET', 'events/' + event.id + '/budget')).remainingBudget, 799.75);
    await api(org, 'DELETE', 'events/' + event.id + '/requirements/' + requirement.id);
    await api(org, 'DELETE', 'shortlist/' + shortlist.id);
    await api(org, 'POST', 'profile/password', { currentPassword: org.plainPassword, newPassword: 'OrganizerAudit456!' });
    await api(org, 'POST', 'auth/login', { email: org.email, password: org.plainPassword }, 401);
    assert((await api(org, 'POST', 'auth/login', { email: org.email, password: 'OrganizerAudit456!' })).token);
    await api(org, 'POST', 'profile/delete-account', { password: 'wrong' }, 400);
    await api(org, 'POST', 'profile/delete-account', { password: 'OrganizerAudit456!' });
    await api(org, 'GET', 'auth/me', undefined, 401);
    assert.equal(await prisma.user.count({ where: { id: vendor.id } }), 1);
    console.log('Organizer password, account deletion, and surviving vendor passed. Total API checks: ' + checks);
  } finally {
    if (browser) { for (const context of browser.contexts()) await context.unrouteAll({ behavior: 'ignoreErrors' }); await browser.close(); }
    if (uploadedPath && fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
    for (const actor of accounts.reverse()) {
      const current = await prisma.user.findUnique({ where: { id: actor.id } });
      if (current?.email.startsWith('workflow-organizer-audit-' + stamp)) await prisma.$transaction(tx => deleteAccountData(tx, actor.id), { timeout: 90000 });
    }
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
});
