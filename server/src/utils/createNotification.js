/**
 * Shared utility to create notifications without duplicating logic.
 * All arguments are optional FKs except userId, title, and content.
 */
const prisma = require('./prisma');
const { flushRedisPublishes } = require('./redis');

const createNotification = async ({
  req,
  userId,
  type = 'GENERAL',
  title,
  content,
  eventId = null,
  inquiryId = null,
  quoteId = null,
  bookingId = null
}) => {
  try {
    // Check user's notification preferences if present
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId }
    });

    if (prefs) {
      if (type === 'EVENT_UPDATED' && !prefs.eventUpdates) return;
      if (type === 'INQUIRY_RESPONSE' && !prefs.vendorActivity) return;
      if (['QUOTE_SUBMITTED', 'QUOTE_UPDATED', 'BOOKING_UPDATED'].includes(type) && !prefs.quotesAndBookings) return;
      if (type === 'GENERAL' && !prefs.generalSystem) return;
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        content,
        eventId,
        inquiryId,
        quoteId,
        bookingId
      }
    });
    req?.app?.get('io')?.to(`user:${userId}`).emit('notification', notification);
    // Let Redis accept the notification before the API function can finish.
    await flushRedisPublishes();
    return notification;
  } catch (err) {
    // Notification creation is non-critical — log but don't crash the parent request
    console.error('[Notification Error]', err.message);
  }
};

module.exports = { createNotification };
