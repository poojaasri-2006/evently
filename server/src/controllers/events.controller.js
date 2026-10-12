const { Prisma } = require('@prisma/client');
const { readEvents } = require('../utils/readModels');
const prisma = require('../utils/prisma');
const { getCommittedBookingTotals, summarizeBudget } = require('../utils/eventBudget');
const { lockVendor, checkVendorDate } = require('../utils/bookingAvailability');
const { createNotification } = require('../utils/createNotification');

const getEvents = async (req, res) => {
  try {
    const userId = req.user.id;

    const organizer = req.organizer || await prisma.organizerProfile.findUnique({
      where: { userId }
    });

    if (!organizer) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    const events = await readEvents(prisma, Prisma.sql`e."organizerId" = ${organizer.id}`);
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching events' });
  }
};

const getEventBudget = async (req, res) => {
  try {
    const { id } = req.params;

    const budget = await prisma.budget.findUnique({
      where: { eventId: id },
      include: { items: true }
    });

    if (!budget) {
      return res.json(null);
    }

    res.json(budget);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching budget' });
  }
};

const createEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const organizer = req.organizer || await prisma.organizerProfile.findUnique({ where: { userId } });
    if (!organizer) return res.status(404).json({ message: 'Organizer not found' });

    const { name, type, date, location, guestCount, budget, description } = req.body;
    const parsedBudget = budget === undefined || budget === null || budget === ''
      ? null
      : Number(budget);
    if (parsedBudget !== null && (!Number.isFinite(parsedBudget) || parsedBudget < 0)) {
      return res.status(400).json({ message: 'Budget must be a non-negative number' });
    }

    const fullDescription = `Event Type: ${type || 'Not specified'}\nExpected Guests: ${guestCount || 'Not specified'}\n\n${description || ''}`;

    const newEvent = await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          organizerId: organizer.id,
          title: name,
          description: fullDescription.trim(),
          date: date ? new Date(date) : null,
          location,
          status: 'DRAFT'
        }
      });

      if (parsedBudget !== null) {
        await tx.budget.create({
          data: {
            eventId: event.id,
            organizerId: organizer.id,
            totalBudget: parsedBudget
          }
        });
      }

      return event;
    });

    res.status(201).json(newEvent);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Unable to create event. Please try again.' });
  }
};

const getEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const organizer = req.organizer || await prisma.organizerProfile.findUnique({ where: { userId } });
    if (!organizer) return res.status(404).json({ message: 'Organizer not found' });

    const [event] = await readEvents(prisma, Prisma.sql`e.id = ${id}`, true);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (event.organizerId !== organizer.id) return res.status(403).json({ message: 'Forbidden' });
    res.json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching event' });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const organizer = req.organizer || await prisma.organizerProfile.findUnique({ where: { userId: req.user.id } });
    if (!organizer) return res.status(404).json({ message: 'Organizer not found' });
    const { title, description, date, location, status } = req.body;
    if (date && Number.isNaN(new Date(date).getTime())) return res.status(400).json({ message: 'Invalid event date' });
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${id} FOR UPDATE`;
      const existing = await tx.event.findUnique({ where: { id } });
      if (!existing) return { code: 404, message: 'Event not found' };
      if (existing.organizerId !== organizer.id) return { code: 403, message: 'Forbidden' };
      if (['CANCELLED', 'COMPLETED'].includes(existing.status) && status && status !== existing.status) return { code: 409, message: 'A cancelled or completed event cannot be reopened' };
      const bookings = await tx.booking.findMany({ where: { eventId: id, status: 'CONFIRMED' } });
      const quotes = await tx.quote.findMany({ where: { id: { in: bookings.map(b => b.quoteId) } }, include: { vendor: true } });
      for (const vendorId of [...new Set(quotes.map(q => q.vendorId))].sort()) {
        await lockVendor(tx, vendorId);
        if (date !== undefined && !['CANCELLED', 'COMPLETED'].includes(status || existing.status)) {
          const conflict = await checkVendorDate(tx, vendorId, date, id);
          if (conflict) return { code: 409, message: conflict };
        }
      }
      const event = await tx.event.update({ where: { id }, data: {
        ...(title !== undefined ? { title } : {}), ...(description !== undefined ? { description } : {}),
        ...(date !== undefined ? { date: date ? new Date(date) : null } : {}), ...(location !== undefined ? { location } : {}), ...(status !== undefined ? { status } : {})
      } });
      if (status === 'CANCELLED' || status === 'COMPLETED') {
        await tx.booking.updateMany({ where: { eventId: id, status: 'CONFIRMED' }, data: { status } });
        const inquiries = await tx.vendorInquiry.findMany({ where: { eventId: id }, select: { id: true } });
        await tx.quote.updateMany({ where: { inquiryId: { in: inquiries.map(i => i.id) }, status: 'PENDING' }, data: { status: 'REJECTED' } });
        if (status === 'CANCELLED') await tx.vendorInquiry.updateMany({ where: { eventId: id, status: { notIn: ['DECLINED', 'CANCELLED'] } }, data: { status: 'CANCELLED' } });
      }
      return { event, quotes };
    }, { timeout: 60000 });
    if (result.message) return res.status(result.code).json({ message: result.message });
    for (const userId of new Set([req.user.id, ...result.quotes.map(q => q.vendor.userId)])) {
      await createNotification({ req, userId, type: 'EVENT_UPDATED', title: 'Event updated', content: result.event.title + ' has been updated.', eventId: id });
    }
    res.json(result.event);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Error updating event' }); }
};

module.exports = { getEvents, getEventBudget, createEvent, getEvent, updateEvent };
