// Calendar dates use the event timezone; availability dates are stored at UTC midnight.
const dateKey = (value) => new Intl.DateTimeFormat('en-CA', {
  timeZone: process.env.EVENT_TIMEZONE || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date(value));
const lockVendor = (tx, vendorId) => tx.$queryRaw`SELECT id FROM "VendorProfile" WHERE id = ${vendorId} FOR UPDATE`;
const checkVendorDate = async (tx, vendorId, date, excludeEventId) => {
  if (!date) return 'Set an event date before booking a vendor.';
  const target = dateKey(date);
  const availability = await tx.vendorAvailability.findMany({ where: { vendorId, isBlocked: true }, select: { date: true } });
  if (availability.some(entry => entry.date.toISOString().slice(0, 10) === target)) return 'The vendor has blocked this event date.';
  const quotes = await tx.quote.findMany({ where: { vendorId }, select: { id: true } });
  const bookings = await tx.booking.findMany({
    where: { quoteId: { in: quotes.map(q => q.id) }, status: 'CONFIRMED', ...(excludeEventId ? { eventId: { not: excludeEventId } } : {}) },
    include: { event: { select: { date: true } } }
  });
  if (bookings.some(b => b.event.date && dateKey(b.event.date) === target)) return 'The vendor already has a booking on this date.';
  return null;
};
module.exports = { dateKey, lockVendor, checkVendorDate };
