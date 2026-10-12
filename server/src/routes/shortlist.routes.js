const express = require('express');
const router = express.Router();

const { getShortlists, addToShortlist, removeShortlist } = require('../controllers/shortlist.controller');
const { authMiddleware, requireOrganizer } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { addToShortlistSchema } = require('../validation/schemas');

router.get('/', authMiddleware, requireOrganizer, getShortlists);
router.post('/', authMiddleware, requireOrganizer, validate(addToShortlistSchema), addToShortlist);
router.delete('/:id', authMiddleware, requireOrganizer, removeShortlist);

module.exports = router;
