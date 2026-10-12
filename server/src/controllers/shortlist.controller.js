const prisma = require('../utils/prisma');

const getShortlists = async (req, res) => {
  try {
    const userId = req.user.id;
    const organizer = req.organizer || await prisma.organizerProfile.findUnique({ where: { userId } });
    if (!organizer) return res.status(404).json({ message: 'Organizer not found' });

    const shortlists = await prisma.shortlist.findMany({
      where: { organizerId: organizer.id, event: { organizerId: organizer.id } },
      include: { event: true }
    });

    const vendorIds = shortlists.map(s => s.vendorId);
    
    const vendors = await prisma.vendorProfile.findMany({
      where: { id: { in: vendorIds } },
      include: {
        category: true,
        services: true,
        packages: true,
        reviews: true
      }
    });

    const vendorMap = new Map();
    vendors.forEach(v => vendorMap.set(v.id, v));

    const enrichedShortlists = shortlists.map(s => ({
      ...s,
      vendor: vendorMap.get(s.vendorId) || null
    }));

    res.json(enrichedShortlists);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching shortlists' });
  }
};

const addToShortlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId, vendorId } = req.body;

    const organizer = req.organizer || await prisma.organizerProfile.findUnique({ where: { userId } });
    if (!organizer) return res.status(404).json({ message: 'Organizer not found' });

    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
      const event = await tx.event.findFirst({ where: { id: eventId, organizerId: organizer.id } });
      if (!event) return { code: 403, message: 'Event not found or unauthorized' };
      const vendor = await tx.vendorProfile.findUnique({ where: { id: vendorId } });
      if (!vendor) return { code: 404, message: 'Vendor not found' };
      const existing = await tx.shortlist.findFirst({ where: { organizerId: organizer.id, eventId, vendorId } });
      if (existing) return { code: 409, message: 'Vendor already shortlisted for this event' };
      return { shortlist: await tx.shortlist.create({ data: { organizerId: organizer.id, eventId, vendorId } }) };
    }, { timeout: 30000 });
    if (result.message) return res.status(result.code).json({ message: result.message });
    res.status(201).json(result.shortlist);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error adding to shortlist' });
  }
};

const removeShortlist = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const organizer = req.organizer || await prisma.organizerProfile.findUnique({ where: { userId } });
    if (!organizer) return res.status(404).json({ message: 'Organizer not found' });

    const shortlist = await prisma.shortlist.findUnique({ where: { id } });
    
    if (!shortlist) return res.status(404).json({ message: 'Shortlist not found' });
    if (shortlist.organizerId !== organizer.id) return res.status(403).json({ message: 'Forbidden' });

    await prisma.shortlist.delete({ where: { id } });

    res.json({ message: 'Shortlist removed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error removing shortlist' });
  }
};

module.exports = { getShortlists, addToShortlist, removeShortlist };
