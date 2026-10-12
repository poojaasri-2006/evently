const prisma = require('../utils/prisma');
const { createNotification } = require('../utils/createNotification');

const createReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { vendorId, rating, comment } = req.body;

    // Validation
    if (!vendorId) {
      return res.status(400).json({ message: 'Vendor ID is required' });
    }
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ message: 'Rating must be a whole number between 1 and 5' });
    }

    const organizer = req.organizer || await prisma.organizerProfile.findUnique({ where: { userId } });
    if (!organizer) {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    const vendor = await prisma.vendorProfile.findUnique({ where: { id: vendorId } });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Eligibility: organizer must have a confirmed or completed booking with this vendor.
    // Path: organizer events -> inquiries on those events for this vendor -> quotes -> bookings.
    const events = await prisma.event.findMany({
      where: { organizerId: organizer.id },
      select: { id: true }
    });
    const eventIds = events.map((e) => e.id);

    const inquiries = await prisma.vendorInquiry.findMany({
      where: { eventId: { in: eventIds }, vendorId },
      select: { id: true }
    });
    const inquiryIds = inquiries.map((i) => i.id);

    const quotes = await prisma.quote.findMany({
      where: { inquiryId: { in: inquiryIds } },
      select: { id: true }
    });
    const quoteIds = quotes.map((q) => q.id);

    const bookings = await prisma.booking.findMany({
      where: { quoteId: { in: quoteIds }, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      select: { id: true }
    });

    if (bookings.length === 0) {
      return res.status(403).json({
        message: 'You can only review a vendor after a booking with them is confirmed or completed.'
      });
    }

    // One review per organizer per vendor
    const existing = await prisma.review.findFirst({
      where: { vendorId, organizerId: organizer.id }
    });
    if (existing) {
      return res.status(409).json({ message: 'You have already reviewed this vendor.' });
    }

    const review = await prisma.review.create({
      data: {
        vendorId,
        organizerId: organizer.id,
        rating: ratingNum,
        comment: comment && comment.trim() ? comment.trim() : null
      }
    });

    // Notify the vendor (non-critical)
    const vendorUser = await prisma.user.findUnique({
      where: { id: vendor.userId },
      select: { id: true }
    });
    if (vendorUser) {
      await createNotification({
      req,
        userId: vendorUser.id,
        type: 'GENERAL',
        title: 'New Review',
        content: `You received a ${ratingNum}-star review on ${vendor.businessName}.`
      });
    }

    res.status(201).json(review);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating review' });
  }
};

module.exports = { createReview };
