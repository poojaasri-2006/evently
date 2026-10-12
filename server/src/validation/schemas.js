const { z } = require('zod');

// Auth
const registerSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(100),
  role: z.enum(['ORGANIZER', 'VENDOR']),
  phone: z.string().max(30).optional(),
  businessName: z.string().max(150).optional(),
  businessCategory: z.string().max(100).optional(),
  businessLocation: z.string().max(200).optional()
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

// Events
const createEventSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.string().max(100).optional(),
  date: z.string().max(50).refine(value => value === '' || !Number.isNaN(new Date(value).getTime()), 'Invalid date').optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  guestCount: z.coerce.number().int().min(1).max(1000000).optional(),
  budget: z.coerce.number().min(0).max(1000000000).optional().nullable(),
  description: z.string().max(5000).optional()
});

const updateEventSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  date: z.string().max(50).refine(value => value === '' || !Number.isNaN(new Date(value).getTime()), 'Invalid date').optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED']).optional()
});

// Quotes
const createQuoteSchema = z.object({
  inquiryId: z.string().min(1),
  details: z.string().trim().min(1).max(10000),
  totalAmount: z.number().positive().max(1000000000)
});

const updateVendorQuoteSchema = z.object({
  details: z.string().trim().min(1).max(10000).optional(),
  totalAmount: z.number().positive().max(1000000000).optional()
});

const updateQuoteStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED'])
});

// Inquiries
const createInquirySchema = z.object({
  eventId: z.string().min(1),
  vendorId: z.string().min(1),
  message: z.string().trim().min(1).max(5000)
});

// Shortlist
const addToShortlistSchema = z.object({
  eventId: z.string().min(1),
  vendorId: z.string().min(1)
});

// Reviews
const createReviewSchema = z.object({
  vendorId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(5000).optional().nullable()
});

module.exports = {
  registerSchema,
  loginSchema,
  createEventSchema,
  updateEventSchema,
  createQuoteSchema,
  updateVendorQuoteSchema,
  updateQuoteStatusSchema,
  createInquirySchema,
  addToShortlistSchema,
  createReviewSchema
};
