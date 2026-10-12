const express = require('express');
const router = express.Router();

const {
  getQuotes,
  getQuoteById,
  updateQuoteStatus,
  createQuote,
  updateVendorQuote
} = require('../controllers/quotes.controller');
const {
  authMiddleware,
  requireOrganizer,
  requireVendor
} = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  createQuoteSchema,
  updateVendorQuoteSchema,
  updateQuoteStatusSchema
} = require('../validation/schemas');

// GET /api/quotes - handles both ORGANIZER (all quotes for their events) and VENDOR (all quotes sent by vendor)
router.get('/', authMiddleware, getQuotes);

// GET /api/quotes/:id - single quote details (accessible to quoting vendor or target organizer)
router.get('/:id', authMiddleware, getQuoteById);

// PATCH /api/quotes/:id/status - Organizer accepts or rejects a quote
router.patch('/:id/status', authMiddleware, requireOrganizer, validate(updateQuoteStatusSchema), updateQuoteStatus);

// POST /api/quotes - Vendor creates a quote
router.post('/', authMiddleware, requireVendor, validate(createQuoteSchema), createQuote);

// PATCH /api/quotes/:id & PUT /api/quotes/:id - Vendor updates a pending quote
router.patch('/:id', authMiddleware, requireVendor, validate(updateVendorQuoteSchema), updateVendorQuote);
router.put('/:id', authMiddleware, requireVendor, validate(updateVendorQuoteSchema), updateVendorQuote);

module.exports = router;
