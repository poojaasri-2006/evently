/**
 * Emit a socket event to a specific user's room.
 * Controllers call this after creating a notification so the recipient's
 * open clients update instantly (in addition to the DB-poll fallback).
 */
const emitToUser = (req, userId, event, payload) => {
  if (!userId) return;
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${userId}`).emit(event, payload);
  }
};

module.exports = { emitToUser };
