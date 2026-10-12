const express = require('express');
const router = express.Router();

const { getVendors, getVendorCategories, getVendorById } = require('../controllers/vendors.controller');

// Public browsing endpoints (vendor marketplace is discoverable without an account)
router.get('/', getVendors);
router.get('/categories', getVendorCategories);
router.get('/:id', getVendorById);

module.exports = router;
