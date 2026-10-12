const { Prisma } = require('@prisma/client');
const { summarizeBudget } = require('./eventBudget');
// PostgreSQL JSON timestamps have no suffix because Prisma stores UTC without a timezone.
const normalizeDates = value => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    ['date','eventDate','createdAt','updatedAt'].includes(key) && typeof item === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(item)
      ? new Date(item + 'Z').toISOString() : normalizeDates(item)
  ]));
};
const readEvents = async (db, filter, detailed = false) => {
  const inquiries = detailed ? Prisma.sql`(SELECT jsonb_agg(to_jsonb(i) || jsonb_build_object('vendor', to_jsonb(v))) FROM "VendorInquiry" i JOIN "VendorProfile" v ON v.id = i."vendorId" WHERE i."eventId" = e.id)` : Prisma.sql`(SELECT jsonb_agg(to_jsonb(i)) FROM "VendorInquiry" i WHERE i."eventId" = e.id)`;
  const rows = await db.$queryRaw`
    SELECT e.*,
      COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM "EventRequirement" r WHERE r."eventId" = e.id), '[]'::jsonb) AS requirements,
      (SELECT to_jsonb(bu) || jsonb_build_object('items', COALESCE((SELECT jsonb_agg(to_jsonb(it)) FROM "BudgetItem" it WHERE it."budgetId" = bu.id), '[]'::jsonb)) FROM "Budget" bu WHERE bu."eventId" = e.id) AS budget,
      COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM "Booking" b WHERE b."eventId" = e.id), '[]'::jsonb) AS bookings,
      COALESCE(${inquiries}, '[]'::jsonb) AS inquiries,
      ${detailed ? Prisma.sql`COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM "Shortlist" s WHERE s."eventId" = e.id), '[]'::jsonb) AS shortlists,` : Prisma.empty}
      COALESCE((SELECT SUM(q."totalAmount") FROM "Booking" b JOIN "Quote" q ON q.id = b."quoteId" AND q.status = 'ACCEPTED' JOIN "VendorInquiry" i ON i.id = q."inquiryId" AND i."vendorId" = q."vendorId" AND i."eventId" = b."eventId" WHERE b."eventId" = e.id AND b.status IN ('CONFIRMED','COMPLETED') AND q."totalAmount" > 0 AND q."totalAmount" < 'Infinity'::double precision), 0)::double precision AS "committedTotal"
    FROM "Event" e WHERE ${filter} ORDER BY e.date ASC
  `;
  return rows.map(row => {
    const { committedTotal, ...event } = normalizeDates(row);
    return { ...event, budget: event.budget ? summarizeBudget(event.budget, Number(committedTotal)) : null };
  });
};
const readBookings = async (db, filter) => normalizeDates(await db.$queryRaw`
  SELECT b.*,
    to_jsonb(e) || jsonb_build_object('organizer', jsonb_build_object('firstName', o."firstName", 'lastName', o."lastName", 'phone', o.phone, 'user', jsonb_build_object('email', u.email))) AS event,
    CASE WHEN i."eventId" = b."eventId" AND i."vendorId" = q."vendorId" THEN to_jsonb(q) || jsonb_build_object('vendor', to_jsonb(v), 'inquiry', jsonb_build_object('id', i.id, 'eventId', i."eventId", 'vendorId', i."vendorId", 'message', i.message, 'createdAt', i."createdAt")) ELSE NULL END AS quote,
    CASE WHEN i."eventId" = b."eventId" AND i."vendorId" = q."vendorId" THEN to_jsonb(v) ELSE NULL END AS vendor
  FROM "Booking" b JOIN "Event" e ON e.id = b."eventId"
  JOIN "OrganizerProfile" o ON o.id = e."organizerId" JOIN "User" u ON u.id = o."userId"
  LEFT JOIN "Quote" q ON q.id = b."quoteId" LEFT JOIN "VendorProfile" v ON v.id = q."vendorId"
  LEFT JOIN "VendorInquiry" i ON i.id = q."inquiryId"
  WHERE ${filter} ORDER BY b."createdAt" DESC
`);
module.exports = { readEvents, readBookings, normalizeDates };
