const prisma = require('../utils/prisma');
const { Prisma } = require('@prisma/client');
const { readBookings, normalizeDates } = require('../utils/readModels');
const getVendorDashboard = async (req, res) => {
  try {
    const vendor = req.vendor;
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });
    const [metadata, bookings] = await Promise.all([
      prisma.$queryRaw`
        SELECT (SELECT COUNT(*) FROM "VendorInquiry" WHERE "vendorId" = ${vendor.id} AND status = 'PENDING') AS "newRequestsCount",
          (SELECT COUNT(*) FROM "Quote" WHERE "vendorId" = ${vendor.id} AND status = 'PENDING') AS "pendingQuotesCount",
          COALESCE((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'eventName', e.title, 'eventDate', e.date, 'organizerName', CASE WHEN o."firstName" <> '' THEN o."firstName" || ' ' || o."lastName" ELSE 'Organizer' END, 'status', r.status, 'createdAt', r."createdAt")) FROM (SELECT * FROM "VendorInquiry" WHERE "vendorId" = ${vendor.id} AND status = 'PENDING' ORDER BY "createdAt" DESC LIMIT 5) r JOIN "Event" e ON e.id = r."eventId" JOIN "OrganizerProfile" o ON o.id = e."organizerId"), '[]'::jsonb) AS "recentRequests"
      `,
      readBookings(prisma, Prisma.sql`q."vendorId" = ${vendor.id}`)
    ]);
    const earningsBookings = bookings.filter(b => ['CONFIRMED','COMPLETED'].includes(b.status)).map(b => ({ id: b.id, eventName: b.event.title, eventDate: b.event.date, status: b.status, amount: b.quote?.totalAmount || 0, createdAt: b.createdAt }));
    const { dateKey } = require('../utils/bookingAvailability');
    const today = dateKey(new Date());
    const isUpcoming = b => b.status === 'CONFIRMED' && b.event.date && dateKey(new Date(b.event.date)) >= today;
    const upcomingBookings = bookings.filter(isUpcoming).sort((a,b) => new Date(a.event.date) - new Date(b.event.date)).slice(0,5).map(b => ({ id: b.id, eventName: b.event.title, eventDate: b.event.date, status: b.status, amount: b.quote?.totalAmount || 0, createdAt: b.createdAt }));
    const completedFields = [vendor.businessName, vendor.description, vendor.phone, vendor.website, vendor.categoryId, vendor.imageUrl, vendor.city || vendor.address, vendor.state || vendor.postalCode].filter(Boolean).length;
    res.json({ vendor: { businessName: vendor.businessName, imageUrl: vendor.imageUrl, city: vendor.city, state: vendor.state, profileCompletion: Math.round(completedFields / 8 * 100) },
      stats: { newRequestsCount: Number(metadata[0].newRequestsCount), pendingQuotesCount: Number(metadata[0].pendingQuotesCount), upcomingBookingsCount: bookings.filter(isUpcoming).length, totalEarnings: earningsBookings.reduce((sum,b) => sum + b.amount,0) },
      recentRequests: normalizeDates(metadata[0].recentRequests), earningsBookings, upcomingBookings });
  } catch (error) { console.error(error); res.status(500).json({ message: 'Error fetching vendor dashboard data' }); }
};
module.exports = { getVendorDashboard };
