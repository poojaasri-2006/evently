const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const eventsRoutes = require('./routes/events.routes');
const vendorsRoutes = require('./routes/vendors.routes');
const inquiriesRoutes = require('./routes/inquiries.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const vendorBookingsRoutes = require('./routes/vendorBookings.routes');
const shortlistRoutes = require('./routes/shortlist.routes');
const quotesRoutes = require('./routes/quotes.routes');
const messagesRoutes = require('./routes/messages.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const profileRoutes = require('./routes/profile.routes');
const vendorDashboardRoutes = require('./routes/vendorDashboard.routes');
const vendorServicesRoutes = require('./routes/vendorServices.routes');
const vendorPackagesRoutes = require('./routes/vendorPackages.routes');
const vendorAvailabilityRoutes = require('./routes/vendorAvailability.routes');
const vendorRequestsRoutes = require('./routes/vendorRequests.routes');
const reviewsRoutes = require('./routes/reviews.routes');

const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Security headers (CSP, HSTS, XSS filter, etc.)
app.use(helmet());

// CORS — only the configured client origin may call the API
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no Origin header (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (origin === allowedOrigin) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
}));

// JSON body parsing with a size limit
app.use(express.json({ limit: '1mb' }));

// Rate limiting — strict on auth (brute-force protection), gentler elsewhere
const authLimiter = rateLimit({
  skip: req => req.method !== 'POST',
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' }
});
app.use('/api/auth', authLimiter);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

app.use('/uploads', (req, res, next) => { res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); next(); }, express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/vendors', vendorsRoutes);
app.use('/api/inquiries', inquiriesRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/vendor/bookings', vendorBookingsRoutes);
app.use('/api/shortlist', shortlistRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/vendor-dashboard', vendorDashboardRoutes);
app.use('/api/vendor/services', vendorServicesRoutes);
app.use('/api/vendor/packages', vendorPackagesRoutes);
app.use('/api/vendor/availability', vendorAvailabilityRoutes);
app.use('/api/vendor/requests', vendorRequestsRoutes);
app.use('/api/reviews', reviewsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', (req, res) => {
  res.status(404).json({
    message: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

module.exports = app;
