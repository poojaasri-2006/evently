const prisma = require('../utils/prisma');
const { lockVendor, dateKey } = require('../utils/bookingAvailability');
const getAvailability = async (req, res) => {
  try {
    const vendor = req.vendor || await prisma.vendorProfile.findUnique({ where: { userId: req.user.id } });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });
    const availability = await prisma.vendorAvailability.findMany({ where: { vendorId: vendor.id }, orderBy: { date: 'asc' } });
    const quotes = await prisma.quote.findMany({ where: { vendorId: vendor.id }, select: { id: true } });
    const bookings = await prisma.booking.findMany({ where: { quoteId: { in: quotes.map(q => q.id) }, status: { in: ['CONFIRMED', 'COMPLETED'] } }, include: { event: true } });
    res.json({ availability, bookings });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Error fetching availability' }); }
};
const saveAvailability = async (req, res) => {
  try {
    const { date, isBlocked, startTime, endTime, reason } = req.body;
    if (isBlocked !== undefined && typeof isBlocked !== 'boolean') return res.status(400).json({ message: 'isBlocked must be a boolean' });
    if ((startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) || (endTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)) || (startTime && endTime && startTime >= endTime)) return res.status(400).json({ message: 'Provide a valid start/end time range' });
    if (reason !== undefined && reason !== null && typeof reason !== 'string') return res.status(400).json({ message: 'Reason must be text' });
    if (!req.params.id && (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime()) || new Date(date).toISOString().slice(0, 10) !== date)) return res.status(400).json({ message: 'A valid calendar date is required' });
    const result = await prisma.$transaction(async tx => {
      const vendor = await tx.vendorProfile.findUnique({ where: { userId: req.user.id } });
      if (!vendor) return { code: 404, message: 'Vendor profile not found' };
      await lockVendor(tx, vendor.id);
      const existing = req.params.id ? await tx.vendorAvailability.findFirst({ where: { id: req.params.id, vendorId: vendor.id } }) : await tx.vendorAvailability.findFirst({ where: { vendorId: vendor.id, date: new Date(date) } });
      if (req.params.id && !existing) return { code: 404, message: 'Availability entry not found' };
      const target = existing ? existing.date.toISOString().slice(0, 10) : date;
      const data = { isBlocked: isBlocked ?? existing?.isBlocked ?? false, startTime: startTime === undefined ? existing?.startTime ?? null : startTime || null, endTime: endTime === undefined ? existing?.endTime ?? null : endTime || null, reason: reason === undefined ? existing?.reason ?? null : reason?.trim() || null };
      if (data.startTime && data.endTime && data.startTime >= data.endTime) return { code: 400, message: 'End time must be after start time' };
      if (data.isBlocked) {
        const quotes = await tx.quote.findMany({ where: { vendorId: vendor.id }, select: { id: true } });
        const bookings = await tx.booking.findMany({ where: { quoteId: { in: quotes.map(q => q.id) }, status: 'CONFIRMED' }, include: { event: true } });
        if (bookings.some(b => b.event.date && dateKey(b.event.date) === target)) return { code: 409, message: 'Cancel the confirmed booking before blocking this date' };
      }
      const entry = existing ? await tx.vendorAvailability.update({ where: { id: existing.id }, data }) : await tx.vendorAvailability.create({ data: { ...data, vendorId: vendor.id, date: new Date(target) } });
      return { code: existing ? 200 : 201, entry };
    }, { timeout: 30000 });
    res.status(result.code).json(result.message ? { message: result.message } : req.params.id ? result.entry : { entry: result.entry, hasBookingConflict: false, booking: null });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Error saving availability' }); }
};
const deleteAvailability = async (req, res) => {
  try {
    const vendor = req.vendor || await prisma.vendorProfile.findUnique({ where: { userId: req.user.id } });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });
    const result = await prisma.vendorAvailability.deleteMany({ where: { id: req.params.id, vendorId: vendor.id } });
    if (!result.count) return res.status(404).json({ message: 'Availability entry not found' });
    res.json({ message: 'Availability entry deleted' });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Error deleting availability' }); }
};
module.exports = { getAvailability, createOrUpdateAvailability: saveAvailability, updateAvailability: saveAvailability, deleteAvailability };
