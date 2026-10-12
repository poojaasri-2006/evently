const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [account] = await prisma.$queryRaw`
      SELECT u.id, u.role, u.email, row_to_json(o) AS "organizerProfile", row_to_json(v) AS "vendorProfile"
      FROM "User" u LEFT JOIN "OrganizerProfile" o ON o."userId" = u.id
      LEFT JOIN "VendorProfile" v ON v."userId" = u.id WHERE u.id = ${decoded.id}
    `;
    if (!account) return res.status(401).json({ message: 'Account no longer exists' });
    req.user = { id: account.id, role: account.role, email: account.email };
    req.organizer = account.organizerProfile;
    req.vendor = account.vendorProfile;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const requireOrganizer = (req, res, next) => {
  if (req.user?.role !== 'ORGANIZER') {
    return res.status(403).json({ message: 'Organizer access required' });
  }
  next();
};

const requireVendor = (req, res, next) => {
  if (req.user?.role !== 'VENDOR') {
    return res.status(403).json({ message: 'Vendor access required' });
  }
  next();
};

module.exports = {
  authMiddleware,
  requireOrganizer,
  requireVendor
};
