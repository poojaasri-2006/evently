const prisma = require('../utils/prisma');
const { Prisma } = require('@prisma/client');
const { readBookings } = require('../utils/readModels');
const { createNotification } = require('../utils/createNotification');
const filterForUser = req => {
  if (req.user.role === 'ORGANIZER' && req.organizer) return Prisma.sql`e."organizerId" = ${req.organizer.id}`;
  if (req.user.role === 'VENDOR' && req.vendor) return Prisma.sql`q."vendorId" = ${req.vendor.id}`;
  return null;
};
const getBookings = async (req, res) => {
  try {
    const filter = filterForUser(req);
    if (!filter) return res.status(404).json({ message: 'Profile not found' });
    res.json(await readBookings(prisma, filter));
  } catch (error) { console.error(error); res.status(500).json({ message: 'Error fetching bookings' }); }
};
const getBookingById = async (req, res) => {
  try {
    const filter = filterForUser(req);
    if (!filter) return res.status(404).json({ message: 'Profile not found' });
    const [booking] = await readBookings(prisma, Prisma.sql`(${filter}) AND b.id = ${req.params.id}`);
    if (!booking || !booking.quote) return res.status(404).json({ message: 'Booking not found' });
    res.json(booking);
  } catch (error) { console.error(error); res.status(500).json({ message: 'Error fetching booking details' }); }
};

const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    if (!['CANCELLED', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be CANCELLED or COMPLETED.' });
    }

    const organizer = req.organizer || await prisma.organizerProfile.findUnique({ where: { userId } });
    if (!organizer) return res.status(404).json({ message: 'Organizer not found' });

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { event: true }
    });

    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.event.organizerId !== organizer.id) return res.status(403).json({ message: 'Forbidden' });
    if (booking.status !== 'CONFIRMED') {
      return res.status(409).json({ message: `Cannot change a booking that is already ${booking.status}` });
    }

    const updatedCount = await prisma.booking.updateMany({
      where: { id, status: 'CONFIRMED' },
      data: { status }
    });
    if (updatedCount.count !== 1) {
      return res.status(409).json({ message: 'This booking has already been updated' });
    }
    const updatedBooking = await prisma.booking.findUnique({ where: { id } });

    await createNotification({
      req,
      userId,
      type: 'BOOKING_UPDATED',
      title: `Booking ${status.toLowerCase()}`,
      content: `Booking for event "${booking.event.title}" has been marked as ${status.toLowerCase()}.`,
      eventId: booking.eventId,
      bookingId: id
    });

    const quote = await prisma.quote.findUnique({
      where: { id: booking.quoteId },
      include: { vendor: true }
    });
    if (quote) {
      await createNotification({
      req,
        userId: quote.vendor.userId,
        type: 'BOOKING_UPDATED',
        title: `Booking ${status.toLowerCase()}`,
        content: `Your booking for event "${booking.event.title}" has been marked as ${status.toLowerCase()} by the organizer.`,
        eventId: booking.eventId,
        bookingId: id,
        quoteId: booking.quoteId
      });
    }

    res.json(updatedBooking);
  } catch (error) {
    console.error('[Update Booking Status Error]', error);
    res.status(500).json({ message: 'Error updating booking status' });
  }
};

module.exports = { getBookings, getBookingById, updateBookingStatus };
