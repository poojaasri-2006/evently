const { Prisma } = require('@prisma/client');
const getCommittedBookingTotals = async (db, eventIds) => {
  if (!eventIds.length) return new Map();
  const totals = await db.$queryRaw`
    SELECT b."eventId", SUM(q."totalAmount") AS total FROM "Booking" b
    JOIN "Quote" q ON q.id = b."quoteId" AND q.status = 'ACCEPTED'
    JOIN "VendorInquiry" i ON i.id = q."inquiryId" AND i."vendorId" = q."vendorId" AND i."eventId" = b."eventId"
    WHERE b."eventId" IN (${Prisma.join(eventIds)}) AND b.status IN ('CONFIRMED', 'COMPLETED')
      AND q."totalAmount" > 0 AND q."totalAmount" < 'Infinity'::double precision
    GROUP BY b."eventId"
  `;
  return new Map(totals.map(row => [row.eventId, Number(row.total)]));
};

const summarizeBudget = (budget, committedBookingTotal) => {
  const items = budget?.items || [];
  const itemTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const totalBudget = budget?.totalBudget || 0;
  const totalAllocated = itemTotal + committedBookingTotal;

  return {
    ...budget,
    items,
    confirmedBookingTotal: committedBookingTotal,
    totalAllocated,
    remainingBudget: totalBudget - totalAllocated,
    overBudget: totalAllocated > totalBudget
  };
};

module.exports = { getCommittedBookingTotals, summarizeBudget };
