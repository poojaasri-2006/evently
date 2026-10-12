const prisma = require('../utils/prisma');

const addPeer = (peers, user, event) => {
  if (!user) return;
  const peer = peers.get(user.id) || { contact: user, events: [] };
  if (event && !peer.events.some((item) => item.id === event.id)) {
    peer.events.push(event);
  }
  peers.set(user.id, peer);
};

const getConversationPeers = async (user, profiles = {}) => {
  if (!['ORGANIZER', 'VENDOR'].includes(user.role)) return null;
  const organizerView = user.role === 'ORGANIZER';
  const profile = organizerView
    ? profiles.organizer || await prisma.organizerProfile.findUnique({ where: { userId: user.id } })
    : profiles.vendor || await prisma.vendorProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return null;
  const rows = await prisma.$queryRaw`
    WITH connections AS (
      SELECT i."eventId", i."vendorId" FROM "VendorInquiry" i
      UNION
      SELECT s."eventId", s."vendorId" FROM "Shortlist" s
      JOIN "Event" e ON e.id = s."eventId" AND e."organizerId" = s."organizerId"
    )
    SELECT json_build_object(
      'id', u.id, 'email', u.email, 'role', u.role,
      'vendorProfile', CASE WHEN cv.id IS NULL THEN NULL ELSE json_build_object('id', cv.id, 'businessName', cv."businessName", 'imageUrl', cv."imageUrl") END,
      'organizerProfile', CASE WHEN co.id IS NULL THEN NULL ELSE json_build_object('id', co.id, 'firstName', co."firstName", 'lastName', co."lastName") END
    ) AS contact, json_build_object('id', e.id, 'title', e.title, 'date', e.date) AS event
    FROM connections c
    JOIN "Event" e ON e.id = c."eventId"
    JOIN "OrganizerProfile" o ON o.id = e."organizerId"
    JOIN "VendorProfile" v ON v.id = c."vendorId"
    JOIN "User" u ON u.id = CASE WHEN ${organizerView} THEN v."userId" ELSE o."userId" END
    LEFT JOIN "VendorProfile" cv ON cv."userId" = u.id
    LEFT JOIN "OrganizerProfile" co ON co."userId" = u.id
    WHERE (${organizerView} AND o.id = ${profile.id}) OR (NOT ${organizerView} AND v.id = ${profile.id})
  `;
  const { normalizeDates } = require('../utils/readModels');
  const peers = new Map();
  for (const row of rows) addPeer(peers, row.contact, normalizeDates(row.event));
  return peers;
};

const getConversations = async (req, res) => {
  try {
    const peers = await getConversationPeers(req.user, req);
    if (!peers) {
      return res.status(404).json({ message: 'Profile not found for this account' });
    }

    const peerIds = [...peers.keys()];
    const messages = peerIds.length
      ? await prisma.message.findMany({
          where: {
            OR: [
              { senderId: req.user.id, receiverId: { in: peerIds } },
              { receiverId: req.user.id, senderId: { in: peerIds } }
            ]
          },
          orderBy: { createdAt: 'desc' }
        })
      : [];

    const latestMessage = new Map();
    messages.forEach((message) => {
      const contactId = message.senderId === req.user.id
        ? message.receiverId
        : message.senderId;
      if (!latestMessage.has(contactId)) latestMessage.set(contactId, message);
    });

    const conversations = [...peers.entries()].map(([contactId, peer]) => ({
      contact: peer.contact,
      events: peer.events,
      lastMessage: latestMessage.get(contactId) || null
    }));
    conversations.sort((left, right) => {
      const leftTime = left.lastMessage ? new Date(left.lastMessage.createdAt).getTime() : 0;
      const rightTime = right.lastMessage ? new Date(right.lastMessage.createdAt).getTime() : 0;
      return rightTime - leftTime;
    });

    return res.json(conversations);
  } catch (error) {
    console.error('[Get Conversations Error]', error);
    return res.status(500).json({ message: 'Error fetching conversations' });
  }
};

const authorizeConversation = async (userId, role, contactId, profiles) => {
  if (typeof contactId !== 'string' || !contactId || contactId === userId) {
    return { error: 'Invalid conversation participant', statusCode: 400 };
  }
  if (!['ORGANIZER', 'VENDOR'].includes(role)) {
    return { error: 'Unauthorized role', statusCode: 403 };
  }

  const peers = await getConversationPeers({ id: userId, role }, profiles);
  if (!peers) return { error: 'Profile not found for this account', statusCode: 404 };
  const peer = peers.get(contactId);
  if (!peer) return { error: 'Conversation not found or unauthorized', statusCode: 404 };
  return { peer };
};

const getMessagesWithUser = async (req, res) => {
  try {
    const authorization = await authorizeConversation(
      req.user.id,
      req.user.role,
      req.params.contactId,
      req
    );
    if (authorization.error) {
      return res.status(authorization.statusCode).json({ message: authorization.error });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.user.id, receiverId: req.params.contactId },
          { senderId: req.params.contactId, receiverId: req.user.id }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });
    return res.json(messages);
  } catch (error) {
    console.error('[Get Messages Error]', error);
    return res.status(500).json({ message: 'Error fetching messages' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }
    if (content.trim().length > 5000) {
      return res.status(400).json({ message: 'Message cannot exceed 5000 characters' });
    }

    const authorization = await authorizeConversation(
      req.user.id,
      req.user.role,
      req.params.contactId,
      req
    );
    if (authorization.error) {
      return res.status(authorization.statusCode).json({ message: authorization.error });
    }

    const message = await prisma.message.create({
      data: {
        senderId: req.user.id,
        receiverId: req.params.contactId,
        content: content.trim()
      }
    });
    return res.status(201).json(message);
  } catch (error) {
    console.error('[Send Message Error]', error);
    return res.status(500).json({ message: 'Error sending message' });
  }
};

module.exports = { getConversations, getMessagesWithUser, sendMessage };
