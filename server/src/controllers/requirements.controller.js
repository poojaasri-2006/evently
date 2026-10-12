const prisma = require('../utils/prisma');
const manageRequirement = async (req, res) => {
  try {
    const organizer = req.organizer || await prisma.organizerProfile.findUnique({ where: { userId: req.user.id } });
    const event = organizer && await prisma.event.findFirst({ where: { id: req.params.eventId, organizerId: organizer.id } });
    if (!event) return res.status(403).json({ message: 'Event not found or unauthorized' });
    const { title, description, category, status } = req.body || {};
    if (req.method !== 'DELETE') {
      if ((!req.params.requirementId || title !== undefined) && (typeof title !== 'string' || !title.trim() || title.length > 200)) return res.status(400).json({ message: 'A requirement title is required (maximum 200 characters)' });
      if (status !== undefined && !['PENDING', 'COMPLETED'].includes(status)) return res.status(400).json({ message: 'Invalid requirement status' });
      if ([description, category].some(value => value !== undefined && value !== null && typeof value !== 'string')) return res.status(400).json({ message: 'Description and category must be text' });
    }
    if (req.params.requirementId) {
      const existing = await prisma.eventRequirement.findFirst({ where: { id: req.params.requirementId, eventId: event.id } });
      if (!existing) return res.status(404).json({ message: 'Requirement not found' });
      if (req.method === 'DELETE') { await prisma.eventRequirement.delete({ where: { id: existing.id } }); return res.json({ message: 'Requirement deleted' }); }
      return res.json(await prisma.eventRequirement.update({ where: { id: existing.id }, data: { ...(title !== undefined ? { title: title.trim() } : {}), ...(description !== undefined ? { description } : {}), ...(category !== undefined ? { category } : {}), ...(status !== undefined ? { status } : {}) } }));
    }
    res.status(201).json(await prisma.eventRequirement.create({ data: { eventId: event.id, title: title.trim(), description: description || null, category: category || null, status: status || 'PENDING' } }));
  } catch (error) { console.error(error); res.status(500).json({ message: 'Unable to save requirement' }); }
};
module.exports = { manageRequirement };
