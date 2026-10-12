const express = require('express');
const router = express.Router();

const { getInquiries, createInquiry, cancelInquiry } = require('../controllers/inquiries.controller');
const { authMiddleware, requireOrganizer } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createInquirySchema } = require('../validation/schemas');

router.get('/', authMiddleware, requireOrganizer, getInquiries);
router.post('/', authMiddleware, requireOrganizer, validate(createInquirySchema), createInquiry);
router.patch('/:id/cancel', authMiddleware, requireOrganizer, cancelInquiry);

module.exports = router;
