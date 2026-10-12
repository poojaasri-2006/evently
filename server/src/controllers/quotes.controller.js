const prisma = require('../utils/prisma');
const { createNotification } = require('../utils/createNotification');
const { lockVendor, checkVendorDate } = require('../utils/bookingAvailability');

const getQuotes = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role === 'ORGANIZER') {
      const organizer = req.organizer || await prisma.organizerProfile.findUnique({ where: { userId } });
      if (!organizer) return res.status(404).json({ message: 'Organizer not found' });

      // Find all inquiries belonging to this organizer's events
      const inquiries = await prisma.vendorInquiry.findMany({
        where: {
          event: {
            organizerId: organizer.id
          }
        },
        include: {
          event: true
        }
      });

      const inquiryIds = inquiries.map(i => i.id);

      // Find quotes for these inquiries
      const quotes = await prisma.quote.findMany({
        where: {
          inquiryId: { in: inquiryIds }
        },
        include: {
          vendor: true
        },
        orderBy: { createdAt: 'desc' }
      });

      // Map the event/inquiry details into the quote response
      const inquiryMap = new Map();
      inquiries.forEach(i => inquiryMap.set(i.id, i));

      const enrichedQuotes = quotes.map(q => {
        const relatedInquiry = inquiryMap.get(q.inquiryId);
        return {
          ...q,
          inquiry: relatedInquiry ? {
            id: relatedInquiry.id,
            message: relatedInquiry.message,
            event: relatedInquiry.event
          } : null
        };
      });

      return res.json(enrichedQuotes);
    } else if (role === 'VENDOR') {
      const vendor = req.vendor || await prisma.vendorProfile.findUnique({ where: { userId } });
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

      const quotes = await prisma.quote.findMany({
        where: { vendorId: vendor.id },
        orderBy: { createdAt: 'desc' }
      });

      const inquiryIds = quotes.map(q => q.inquiryId);
      const inquiries = await prisma.vendorInquiry.findMany({
        where: { id: { in: inquiryIds } },
        include: {
          event: {
            include: {
              organizer: {
                include: {
                  user: { select: { id: true, email: true } }
                }
              },
              requirements: true
            }
          }
        }
      });

      const inquiryMap = new Map();
      inquiries.forEach(i => inquiryMap.set(i.id, i));

      const enrichedQuotes = quotes.map(q => {
        const relatedInquiry = inquiryMap.get(q.inquiryId);
        return {
          ...q,
          inquiry: relatedInquiry || null,
          event: relatedInquiry?.event || null
        };
      });

      return res.json(enrichedQuotes);
    } else {
      return res.status(403).json({ message: 'Unauthorized role' });
    }
  } catch (error) {
    console.error('[Get Quotes Error]', error);
    res.status(500).json({ message: 'Error fetching quotes' });
  }
};

const getQuoteById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { vendor: true }
    });
    if (!quote) return res.status(404).json({ message: 'Quote not found' });

    const inquiry = await prisma.vendorInquiry.findUnique({
      where: { id: quote.inquiryId },
      include: {
        event: {
          include: {
            organizer: {
              include: { user: { select: { id: true, email: true } } }
            },
            requirements: true
          }
        }
      }
    });

    if (role === 'VENDOR') {
      const vendor = req.vendor || await prisma.vendorProfile.findUnique({ where: { userId } });
      if (!vendor || quote.vendorId !== vendor.id) {
        return res.status(404).json({ message: 'Quote not found or unauthorized' });
      }
    } else if (role === 'ORGANIZER') {
      const organizer = req.organizer || await prisma.organizerProfile.findUnique({ where: { userId } });
      if (!organizer || !inquiry || inquiry.event.organizerId !== organizer.id) {
        return res.status(404).json({ message: 'Quote not found or unauthorized' });
      }
    }

    res.json({
      ...quote,
      inquiry: inquiry || null,
      event: inquiry?.event || null
    });
  } catch (error) {
    console.error('[Get Quote By ID Error]', error);
    res.status(500).json({ message: 'Error fetching quote details' });
  }
};

const updateQuoteStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    if (!['ACCEPTED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const organizer = req.organizer || await prisma.organizerProfile.findUnique({ where: { userId } });
    if (!organizer) return res.status(404).json({ message: 'Organizer not found' });

    const decision = await prisma.$transaction(async (tx) => {
      let quote = await tx.quote.findUnique({
        where: { id },
        include: { vendor: true }
      });
      if (!quote) return { error: 'Quote not found', statusCode: 404 };

      let inquiry = await tx.vendorInquiry.findUnique({
        where: { id: quote.inquiryId },
        include: { event: true }
      });
      if (!inquiry || inquiry.vendorId !== quote.vendorId) {
        return { error: 'Quote is not linked to a valid vendor inquiry', statusCode: 409 };
      }
      if (inquiry.event.organizerId !== organizer.id) {
        return { error: 'Forbidden', statusCode: 403 };
      }

      if (status === 'ACCEPTED') {
        await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${inquiry.eventId} FOR UPDATE`;
        const currentEvent = await tx.event.findUnique({ where: { id: inquiry.eventId } });
        if (['CANCELLED', 'COMPLETED'].includes(currentEvent.status) || ['CANCELLED', 'DECLINED'].includes(inquiry.status)) {
          return { error: 'Cannot book a cancelled/completed event or a cancelled/declined inquiry', statusCode: 409 };
        }
        await lockVendor(tx, quote.vendorId);
        await tx.$queryRaw`SELECT id FROM "VendorInquiry" WHERE id = ${inquiry.id} FOR UPDATE`;
        inquiry = await tx.vendorInquiry.findUnique({ where: { id: inquiry.id }, include: { event: true } });
        if (['CANCELLED', 'DECLINED'].includes(inquiry.status)) return { error: 'Inquiry is no longer available for booking', statusCode: 409 };
        inquiry.event = currentEvent;
        await tx.$queryRaw`SELECT id FROM "Quote" WHERE id = ${quote.id} FOR UPDATE`;
        quote = await tx.quote.findUnique({ where: { id: quote.id }, include: { vendor: true } });
        const conflict = await checkVendorDate(tx, quote.vendorId, currentEvent.date);
        if (conflict) return { error: conflict, statusCode: 409 };
      }
      if (quote.status !== 'PENDING') {
        return {
          error: `Cannot update a quote that is already ${quote.status}`,
          statusCode: 409
        };
      }
      if (!Number.isFinite(quote.totalAmount) || quote.totalAmount <= 0) {
        return { error: 'Quote amount must be positive before it can be accepted', statusCode: 409 };
      }

      const existingBooking = await tx.booking.findFirst({
        where: { quoteId: quote.id }
      });
      if (existingBooking) {
        return { error: 'A booking already exists for this quote', statusCode: 409 };
      }

      const updatedCount = await tx.quote.updateMany({
        where: { id: quote.id, status: 'PENDING' },
        data: { status }
      });
      if (updatedCount.count !== 1) {
        return { error: 'This quote has already been decided', statusCode: 409 };
      }

      const booking = status === 'ACCEPTED'
        ? await tx.booking.create({
            data: {
              eventId: inquiry.eventId,
              quoteId: quote.id
            }
          })
        : null;

      const updatedQuote = await tx.quote.findUnique({ where: { id: quote.id } });
      return { quote: updatedQuote, booking, vendor: quote.vendor, inquiry };
    }, { timeout: 30000 });

    if (decision.error) {
      return res.status(decision.statusCode).json({ message: decision.error });
    }

    const decisionVerb = status === 'ACCEPTED' ? 'accepted' : 'declined';
    await createNotification({
      req,
      userId: decision.vendor.userId,
      type: 'QUOTE_UPDATED',
      title: `Your quote was ${decisionVerb}`,
      content: `The organizer has ${decisionVerb} your quote for event "${decision.inquiry.event.title}".`,
      eventId: decision.inquiry.eventId,
      inquiryId: decision.inquiry.id,
      quoteId: id
    });

    await createNotification({
      req,
      userId,
      type: 'QUOTE_UPDATED',
      title: `Quote ${decisionVerb}`,
      content: `You ${decisionVerb} the quote from ${decision.vendor.businessName} for event "${decision.inquiry.event.title}".`,
      eventId: decision.inquiry.eventId,
      inquiryId: decision.inquiry.id,
      quoteId: id
    });

    res.json({ ...decision.quote, vendor: decision.vendor, inquiry: decision.inquiry, event: decision.inquiry.event, booking: decision.booking });
  } catch (error) {
    console.error('[Update Quote Status Error]', error);
    if (['P2002', 'P2034'].includes(error.code)) {
      return res.status(409).json({ message: 'A booking already exists for this quote' });
    }
    res.status(500).json({ message: 'Error updating quote' });
  }
};

// Allow vendor to submit a quote for an inquiry
const createQuote = async (req, res) => {
  try {
    const userId = req.user.id;
    const { inquiryId, details, totalAmount } = req.body;

    if (typeof inquiryId !== 'string' || !inquiryId.trim() ||
        typeof details !== 'string' || !details.trim() ||
        totalAmount === undefined || totalAmount === null) {
      return res.status(400).json({ message: 'inquiryId, details, and totalAmount are required' });
    }

    const parsedAmount = Number(totalAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'totalAmount must be a positive number' });
    }

    const vendor = req.vendor || await prisma.vendorProfile.findUnique({ where: { userId } });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });

    // Verify the inquiry belongs to this vendor
    const inquiry = await prisma.vendorInquiry.findFirst({
      where: { id: inquiryId.trim(), vendorId: vendor.id },
      include: { event: { include: { organizer: true } } }
    });
    if (!inquiry) return res.status(404).json({ message: 'Inquiry not found or unauthorized' });

    if (['DECLINED', 'CANCELLED'].includes(inquiry.status)) {
      return res.status(400).json({ message: `Cannot submit a quote for a ${inquiry.status.toLowerCase()} request` });
    }

    const existing = await prisma.quote.findFirst({
      where: { inquiryId: inquiry.id, vendorId: vendor.id }
    });
    if (existing) {
      return res.status(409).json({ message: 'A quote already exists for this inquiry. You can edit the existing quote.' });
    }

    const quote = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${inquiry.eventId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "VendorInquiry" WHERE id = ${inquiry.id} FOR UPDATE`;
      const currentInquiry = await tx.vendorInquiry.findUnique({ where: { id: inquiry.id }, include: { event: true } });
      if (['CANCELLED', 'DECLINED'].includes(currentInquiry.status) || ['CANCELLED', 'COMPLETED'].includes(currentInquiry.event.status)) {
        const error = new Error('This inquiry or event is no longer available for quotes'); error.statusCode = 409; throw error;
      }
      if (await tx.quote.findFirst({ where: { inquiryId: inquiry.id, vendorId: vendor.id } })) {
        const error = new Error('A quote already exists for this inquiry'); error.statusCode = 409; throw error;
      }
      const createdQuote = await tx.quote.create({
        data: {
          vendorId: vendor.id,
          inquiryId: inquiry.id,
          details: details.trim(),
          totalAmount: parsedAmount,
          status: 'PENDING'
        }
      });

      if (currentInquiry.status === 'PENDING') {
        await tx.vendorInquiry.update({
          where: { id: inquiry.id },
          data: { status: 'RESPONDED' }
        });
      }

      return createdQuote;
    }, { timeout: 30000 });

    if (inquiry.event.organizer?.userId) {
      await createNotification({
      req,
        userId: inquiry.event.organizer.userId,
        type: 'QUOTE_SUBMITTED',
        title: 'New Quote Received',
        content: `${vendor.businessName} submitted a quote of ₹${parsedAmount.toLocaleString('en-IN')} for event "${inquiry.event.title}".`,
        eventId: inquiry.eventId,
        inquiryId: inquiry.id,
        quoteId: quote.id
      });
    }

    res.status(201).json(quote);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error('[Create Quote Error]', error);
    res.status(500).json({ message: 'Error creating quote' });
  }
};

// Allow vendor to update an existing pending quote
const updateVendorQuote = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { details, totalAmount } = req.body;

    const vendor = req.vendor || await prisma.vendorProfile.findUnique({ where: { userId } });
    if (!vendor) return res.status(404).json({ message: 'Vendor profile not found' });

    const quote = await prisma.quote.findFirst({
      where: { id, vendorId: vendor.id }
    });
    if (!quote) return res.status(404).json({ message: 'Quote not found or unauthorized' });

    if (quote.status !== 'PENDING') {
      return res.status(400).json({ message: `Cannot update a quote that is already ${quote.status.toLowerCase()}` });
    }

    const dataToUpdate = {};
    if (details !== undefined) {
      if (typeof details !== 'string' || !details.trim()) {
        return res.status(400).json({ message: 'Quote details cannot be empty' });
      }
      dataToUpdate.details = details.trim();
    }

    if (totalAmount !== undefined && totalAmount !== null) {
      const parsed = Number(totalAmount);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return res.status(400).json({ message: 'Total amount must be greater than zero' });
      }
      dataToUpdate.totalAmount = parsed;
    }

    const update = await prisma.quote.updateMany({ where: { id, vendorId: vendor.id, status: 'PENDING' }, data: dataToUpdate });
    if (update.count !== 1) return res.status(409).json({ message: 'Quote has already been decided' });
    const updatedQuote = await prisma.quote.findUnique({ where: { id } });

    // Notify the organizer about the quote update
    const inquiry = await prisma.vendorInquiry.findUnique({
      where: { id: quote.inquiryId },
      include: { event: { include: { organizer: true } } }
    });
    if (inquiry?.event?.organizer?.userId) {
      await createNotification({
      req,
        userId: inquiry.event.organizer.userId,
        type: 'QUOTE_UPDATED',
        title: 'Quote Updated',
        content: `${vendor.businessName} updated their quote for event "${inquiry.event.title}".`,
        eventId: inquiry.eventId,
        inquiryId: quote.inquiryId,
        quoteId: quote.id
      });
    }

    res.json(updatedQuote);
  } catch (error) {
    console.error('[Update Vendor Quote Error]', error);
    res.status(500).json({ message: 'Error updating quote' });
  }
};

module.exports = {
  getQuotes,
  getQuoteById,
  updateQuoteStatus,
  createQuote,
  updateVendorQuote
};
