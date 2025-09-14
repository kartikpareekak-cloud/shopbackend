import express from 'express';
import {
  createOrder,
  verifyPayment,
  getPaymentStatus,
  handleWebhook
} from '../controllers/cashfreeController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/payment/test
// @desc    Test payment routes are working
// @access  Public
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Payment routes are working!',
    timestamp: new Date().toISOString(),
    hasPayment: true
  });
});

// @route   POST /api/payment/create-order
// @desc    Create Cashfree order
// @access  Private
router.post('/create-order', protect, createOrder);

// @route   POST /api/payment/verify
// @desc    Verify Cashfree payment and create order
// @access  Private
router.post('/verify', protect, verifyPayment);

// @route   GET /api/payment/status/:orderId
// @desc    Get payment status
// @access  Private
router.get('/status/:orderId', protect, getPaymentStatus);

// @route   POST /api/payment/webhook
// @desc    Handle Cashfree webhook
// @access  Public
router.post('/webhook', handleWebhook);

export default router;
