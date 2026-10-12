const express = require('express');
const router = express.Router();

const { getEvents, createEvent, getEvent, updateEvent } = require('../controllers/events.controller');
const { getBudget, updateBudget, addBudgetItem, deleteBudgetItem } = require('../controllers/budget.controller');
const { authMiddleware, requireOrganizer } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createEventSchema, updateEventSchema } = require('../validation/schemas');

router.get('/', authMiddleware, requireOrganizer, getEvents);
router.post('/', authMiddleware, requireOrganizer, validate(createEventSchema), createEvent);
router.get('/:id', authMiddleware, requireOrganizer, getEvent);
router.patch('/:id', authMiddleware, requireOrganizer, validate(updateEventSchema), updateEvent);


const { manageRequirement } = require('../controllers/requirements.controller');
router.post('/:eventId/requirements', authMiddleware, requireOrganizer, manageRequirement);
router.patch('/:eventId/requirements/:requirementId', authMiddleware, requireOrganizer, manageRequirement);
router.delete('/:eventId/requirements/:requirementId', authMiddleware, requireOrganizer, manageRequirement);

// Budget routes nested under events
router.get('/:eventId/budget', authMiddleware, requireOrganizer, getBudget);
router.post('/:eventId/budget', authMiddleware, requireOrganizer, updateBudget);
router.post('/:eventId/budget/items', authMiddleware, requireOrganizer, addBudgetItem);
router.delete('/:eventId/budget/items/:itemId', authMiddleware, requireOrganizer, deleteBudgetItem);

module.exports = router;
