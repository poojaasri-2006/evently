const express = require('express');
const router = express.Router();

const { createReview } = require('../controllers/reviews.controller');
const { authMiddleware, requireOrganizer } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createReviewSchema } = require('../validation/schemas');

// POST /api/reviews - Organizer leaves a review for a vendor they have booked
router.post('/', authMiddleware, requireOrganizer, validate(createReviewSchema), createReview);

module.exports = router;
