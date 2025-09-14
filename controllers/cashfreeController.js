import axios from 'axios';
import crypto from 'crypto';
import Order from '../models/Order.js';

// Cashfree configuration
const getCashfreeConfig = () => ({
  clientId: process.env.CASHFREE_CLIENT_ID,
  clientSecret: process.env.CASHFREE_CLIENT_SECRET,
  baseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://api.cashfree.com/pg' 
    : 'https://sandbox.cashfree.com/pg'
});

// @desc    Create Cashfree order
export const createOrder = async (req, res) => {
  try {
    const { amount, customerDetails } = req.body;
    const config = getCashfreeConfig();

    if (!config.clientId || !config.clientSecret) {
      return res.status(500).json({
        success: false,
        message: 'Cashfree configuration missing'
      });
    }

    const orderId = `PJA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create order payload for Cashfree
    const orderPayload = {
      order_id: orderId,
      order_amount: amount,
      order_currency: 'INR',
      customer_details: {
        customer_id: customerDetails.email,
        customer_name: customerDetails.name,
        customer_email: customerDetails.email,
        customer_phone: customerDetails.phone
      },
      order_meta: {
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
        notify_url: `${process.env.BACKEND_URL}/api/payment/webhook`
      }
    };

    // Make API call to Cashfree
    const response = await axios.post(
      `${config.baseUrl}/orders`,
      orderPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': config.clientId,
          'x-client-secret': config.clientSecret,
          'x-api-version': '2022-09-01'
        }
      }
    );

    if (response.data && response.data.payment_session_id) {
      res.json({
        success: true,
        orderId: orderId,
        paymentSessionId: response.data.payment_session_id,
        message: 'Order created successfully'
      });
    } else {
      throw new Error('Invalid response from Cashfree API');
    }
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: error.response?.data?.message || error.message
    });
  }
};

// @desc    Verify Cashfree payment
export const verifyPayment = async (req, res) => {
  try {
    const { 
      orderId, 
      orderAmount, 
      referenceId, 
      txStatus, 
      paymentMode, 
      txMsg, 
      txTime, 
      signature,
      orderData 
    } = req.body;

    const config = getCashfreeConfig();
    
    // Verify payment with Cashfree API
    const response = await axios.get(
      `${config.baseUrl}/orders/${orderId}/payments`,
      {
        headers: {
          'x-client-id': config.clientId,
          'x-client-secret': config.clientSecret,
          'x-api-version': '2022-09-01'
        }
      }
    );

    const paymentData = response.data;
    
    if (paymentData && paymentData.length > 0) {
      const payment = paymentData[0];
      
      if (payment.payment_status === 'SUCCESS') {
        // Create order in database
        const order = new Order({
          user: req.user._id,
          items: orderData.items,
          shippingAddress: orderData.shippingAddress,
          paymentMethod: 'ONLINE',
          itemsPrice: orderData.itemsPrice,
          shippingPrice: orderData.shippingPrice,
          total: orderData.totalPrice,
          paymentResult: {
            id: payment.cf_payment_id,
            status: payment.payment_status,
            paymentMethod: payment.payment_method,
            transactionId: payment.payment_group,
            amount: payment.payment_amount
          },
          status: 'confirmed',
          tracking: {
            trackingNumber: `PJA${Date.now()}${Math.floor(Math.random() * 1000)}`,
            carrier: 'Panditji Auto Connect Delivery',
            estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            currentLocation: 'Order Processing Center',
            statusHistory: [{
              status: 'Payment Confirmed',
              location: 'Payment Gateway',
              timestamp: new Date(),
              description: 'Payment has been successfully processed.'
            }]
          }
        });

        await order.save();
        await order.populate('items.product user');

        res.json({
          success: true,
          message: 'Payment verified and order created successfully',
          orderId: order._id
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Payment verification failed - payment not successful'
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: 'Payment data not found'
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.response?.data?.message || error.message
    });
  }
};

// @desc    Get payment status
export const getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const config = getCashfreeConfig();

    // Get payment status from Cashfree
    const response = await axios.get(
      `${config.baseUrl}/orders/${orderId}`,
      {
        headers: {
          'x-client-id': config.clientId,
          'x-client-secret': config.clientSecret,
          'x-api-version': '2022-09-01'
        }
      }
    );

    const orderData = response.data;

    res.json({
      success: true,
      data: {
        order_id: orderData.order_id,
        order_status: orderData.order_status,
        order_amount: orderData.order_amount,
        payment_status: orderData.payment_status || 'PENDING'
      }
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment status',
      error: error.response?.data?.message || error.message
    });
  }
};

// @desc    Handle Cashfree webhook
export const handleWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    const config = getCashfreeConfig();
    
    // Verify webhook signature (implement signature verification based on Cashfree docs)
    // For now, we'll process the webhook data
    
    console.log('Received Cashfree webhook:', webhookData);
    
    if (webhookData.type === 'PAYMENT_SUCCESS_WEBHOOK') {
      const { order } = webhookData.data;
      
      // Find and update the order in database
      const dbOrder = await Order.findOne({ 
        'tracking.trackingNumber': { $regex: order.order_id } 
      });
      
      if (dbOrder) {
        dbOrder.status = 'confirmed';
        dbOrder.paymentResult = {
          id: webhookData.data.payment.cf_payment_id,
          status: 'SUCCESS',
          paymentMethod: webhookData.data.payment.payment_method,
          transactionId: webhookData.data.payment.payment_group,
          amount: webhookData.data.payment.payment_amount
        };
        
        // Add webhook confirmation to tracking
        dbOrder.tracking.statusHistory.push({
          status: 'Payment Webhook Confirmed',
          location: 'Payment Gateway',
          timestamp: new Date(),
          description: 'Payment confirmation received via webhook.'
        });
        
        await dbOrder.save();
        console.log('Order updated from webhook:', dbOrder._id);
      }
    }
    
    // Always respond with success to acknowledge webhook receipt
    res.json({ 
      success: true,
      message: 'Webhook processed successfully' 
    });
  } catch (error) {
    console.error('Webhook handling error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message
    });
  }
};
