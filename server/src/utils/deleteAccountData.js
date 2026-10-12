const deleteAccountData = async (tx, userId) => {
  const organizer = await tx.organizerProfile.findUnique({ where: { userId } });
  const vendor = await tx.vendorProfile.findUnique({ where: { userId } });
  const events = organizer ? await tx.event.findMany({ where: { organizerId: organizer.id }, select: { id: true } }) : [];
  const eventIds = events.map(e => e.id);
  const inquiries = await tx.vendorInquiry.findMany({ where: { OR: [{ eventId: { in: eventIds } }, ...(vendor ? [{ vendorId: vendor.id }] : [])] }, select: { id: true } });
  const inquiryIds = inquiries.map(i => i.id);
  const quotes = await tx.quote.findMany({ where: { OR: [{ inquiryId: { in: inquiryIds } }, ...(vendor ? [{ vendorId: vendor.id }] : [])] }, select: { id: true } });
  const quoteIds = quotes.map(q => q.id);
  const bookings = await tx.booking.findMany({ where: { OR: [{ eventId: { in: eventIds } }, { quoteId: { in: quoteIds } }] }, select: { id: true } });
  await tx.notification.deleteMany({ where: { OR: [{ userId }, { eventId: { in: eventIds } }, { inquiryId: { in: inquiryIds } }, { quoteId: { in: quoteIds } }, { bookingId: { in: bookings.map(b => b.id) } }] } });
  await tx.booking.deleteMany({ where: { id: { in: bookings.map(b => b.id) } } });
  await tx.quote.deleteMany({ where: { id: { in: quoteIds } } });
  await tx.vendorInquiry.deleteMany({ where: { id: { in: inquiryIds } } });
  await tx.shortlist.deleteMany({ where: { OR: [{ eventId: { in: eventIds } }, ...(organizer ? [{ organizerId: organizer.id }] : []), ...(vendor ? [{ vendorId: vendor.id }] : [])] } });
  await tx.review.deleteMany({ where: { OR: [...(organizer ? [{ organizerId: organizer.id }] : []), ...(vendor ? [{ vendorId: vendor.id }] : [])] } });
  if (organizer) {
    const budgets = await tx.budget.findMany({ where: { organizerId: organizer.id }, select: { id: true } });
    await tx.budgetItem.deleteMany({ where: { budgetId: { in: budgets.map(b => b.id) } } });
    await tx.budget.deleteMany({ where: { organizerId: organizer.id } });
    await tx.eventRequirement.deleteMany({ where: { eventId: { in: eventIds } } });
    await tx.event.deleteMany({ where: { id: { in: eventIds } } });
    await tx.organizerProfile.delete({ where: { id: organizer.id } });
  }
  if (vendor) {
    await tx.vendorAvailability.deleteMany({ where: { vendorId: vendor.id } });
    await tx.vendorPackage.deleteMany({ where: { vendorId: vendor.id } });
    await tx.vendorService.deleteMany({ where: { vendorId: vendor.id } });
    await tx.vendorProfile.delete({ where: { id: vendor.id } });
  }
  await tx.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } });
  await tx.notificationPreference.deleteMany({ where: { userId } });
  await tx.user.delete({ where: { id: userId } });
};
module.exports = { deleteAccountData };
