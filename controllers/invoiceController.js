import Order from '../models/Order.js';
import invoiceService from '../services/invoiceService.js';
import emailService from '../services/emailService.js';

// @desc    Generate invoice for an order
// @route   GET /api/invoices/:orderId
// @access  Private
export const generateInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email')
      .populate('orderItems.product', 'name');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order or is admin
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this invoice'
      });
    }

    // Generate invoice data
    const invoiceData = invoiceService.generateInvoiceData(order);

    res.json({
      success: true,
      data: invoiceData
    });
  } catch (error) {
    console.error('Generate invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate invoice',
      error: error.message
    });
  }
};

// @desc    Generate and download invoice HTML
// @route   GET /api/invoices/:orderId/download
// @access  Private
export const downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email')
      .populate('orderItems.product', 'name');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order or is admin
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this invoice'
      });
    }

    // Generate invoice HTML
    const invoiceHTML = invoiceService.generateInvoiceHTML(order);

    // Set response headers for file download
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderNumber}.html"`);
    
    res.send(invoiceHTML);
  } catch (error) {
    console.error('Download invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download invoice',
      error: error.message
    });
  }
};

// @desc    Email invoice to customer
// @route   POST /api/invoices/:orderId/email
// @access  Private/Admin
export const emailInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email')
      .populate('orderItems.product', 'name');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Only admin can send invoice emails
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send invoice emails'
      });
    }

    const customerEmail = order.shippingAddress.email || order.user.email;
    if (!customerEmail) {
      return res.status(400).json({
        success: false,
        message: 'Customer email not found'
      });
    }

    // Generate invoice HTML and save to file
    const invoiceResult = await invoiceService.saveInvoiceHTML(order);
    
    if (!invoiceResult.success) {
      throw new Error('Failed to generate invoice file');
    }

    // Send email with invoice attachment
    await emailService.sendInvoice(order, customerEmail, invoiceResult.filePath);

    res.json({
      success: true,
      message: 'Invoice sent successfully',
      data: {
        sentTo: customerEmail,
        invoiceNumber: `INV-${order.orderNumber}`
      }
    });
  } catch (error) {
    console.error('Email invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send invoice email',
      error: error.message
    });
  }
};

// @desc    Get invoice HTML for preview
// @route   GET /api/invoices/:orderId/preview
// @access  Private
export const previewInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('user', 'name email')
      .populate('orderItems.product', 'name');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order or is admin
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this invoice'
      });
    }

    // Generate invoice HTML
    const invoiceHTML = invoiceService.generateInvoiceHTML(order);

    // Set content type to HTML
    res.setHeader('Content-Type', 'text/html');
    res.send(invoiceHTML);
  } catch (error) {
    console.error('Preview invoice error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to preview invoice',
      error: error.message
    });
  }
};

// @desc    Get all invoices for admin
// @route   GET /api/invoices
// @access  Private/Admin
export const getAllInvoices = async (req, res) => {
  try {
    // Only admin can access all invoices
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access invoices'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get orders with basic invoice info
    const orders = await Order.find({ isPaid: true })
      .populate('user', 'name email')
      .select('orderNumber user totalPrice createdAt orderStatus isPaid')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments({ isPaid: true });

    const invoices = orders.map(order => ({
      invoiceNumber: `INV-${order.orderNumber}`,
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerName: order.user.name,
      customerEmail: order.user.email,
      amount: order.totalPrice,
      invoiceDate: order.createdAt,
      status: order.isPaid ? 'Paid' : 'Pending'
    }));

    res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all invoices error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
      error: error.message
    });
  }
};