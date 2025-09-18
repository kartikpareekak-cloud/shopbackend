import express from 'express';
import { protect, admin } from '../middleware/auth.js';
import {
  generateInvoice,
  downloadInvoice,
  emailInvoice,
  previewInvoice,
  getAllInvoices
} from '../controllers/invoiceController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// @route   GET /api/invoices
// @desc    Get all invoices (Admin only)
// @access  Private/Admin
router.get('/', admin, getAllInvoices);

// @route   GET /api/invoices/:orderId
// @desc    Generate invoice for an order
// @access  Private
router.get('/:orderId', generateInvoice);

// @route   GET /api/invoices/:orderId/preview
// @desc    Preview invoice HTML
// @access  Private
router.get('/:orderId/preview', previewInvoice);

// @route   GET /api/invoices/:orderId/download
// @desc    Download invoice HTML file
// @access  Private
router.get('/:orderId/download', downloadInvoice);

// @route   POST /api/invoices/:orderId/email
// @desc    Email invoice to customer
// @access  Private/Admin
router.post('/:orderId/email', admin, emailInvoice);

export default router;