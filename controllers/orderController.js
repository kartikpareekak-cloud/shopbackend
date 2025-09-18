import Order from '../models/Order.js';
import Product from '../models/Product.js';
import notificationService from '../services/notificationService.js';

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
export const createOrder = async (req, res) => {
  try {
    const {
      orderItems,
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice,
      notes
    } = req.body;

    if (orderItems && orderItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No order items'
      });
    }

    // Verify products exist and get current prices
    const orderItemsWithDetails = await Promise.all(
      orderItems.map(async (item) => {
        const product = await Product.findById(item.product);
        if (!product) {
          throw new Error(`Product not found: ${item.product}`);
        }
        
        if (!product.inStock || product.stockQuantity < item.quantity) {
          throw new Error(`Product ${product.name} is out of stock`);
        }

        return {
          ...item,
          name: product.name,
          image: product.image || product.images?.[0]?.url || '/placeholder.svg',
          price: product.price
        };
      })
    );

    const order = new Order({
      user: req.user._id,
      items: orderItemsWithDetails, // Use items instead of orderItems for consistency
      shippingAddress,
      paymentMethod,
      itemsPrice,
      taxPrice,
      shippingPrice,
      totalPrice, // Frontend sends totalPrice
      notes
    });

    const createdOrder = await order.save();
    await createdOrder.populate('user', 'name email');

    // Update product stock quantities
    await Promise.all(
      orderItems.map(async (item) => {
        const product = await Product.findById(item.product);
        product.stockQuantity -= item.quantity;
        if (product.stockQuantity <= 0) {
          product.inStock = false;
        }
        await product.save();
      })
    );

    // Emit socket event for new order (to admins)
    notificationService.emitToAdmins('new_order', {
      orderId: createdOrder._id,
      orderNumber: createdOrder.orderNumber,
      customerName: createdOrder.user?.name || 'Unknown',
      customerEmail: createdOrder.user?.email || 'Unknown',
      totalPrice: createdOrder.totalPrice,
      status: createdOrder.status,
      itemCount: createdOrder.items.length,
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: createdOrder
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while creating order'
    });
  }
};

// @desc    Get all orders (Admin)
// @route   GET /api/orders
// @access  Private/Admin
export const getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.orderStatus = req.query.status;
    }

    const orders = await Order.find(filter)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching orders'
    });
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
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
        message: 'Not authorized to view this order'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching order'
    });
  }
};

// @desc    Update order status (Admin)
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    const order = await Order.findById(req.params.id).populate('user', 'name email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const oldStatus = order.orderStatus;
    order.orderStatus = status;

    if (status === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
    }

    const updatedOrder = await order.save();

    // Emit socket event for order status update
    notificationService.emitToUser(order.user._id, 'order_status_updated', {
      orderId: updatedOrder._id,
      orderNumber: updatedOrder.orderNumber,
      oldStatus,
      newStatus: status,
      status,
      timestamp: new Date()
    });

    // Also emit to admins for dashboard updates
    notificationService.emitToAdmins('order_status_changed', {
      orderId: updatedOrder._id,
      orderNumber: updatedOrder.orderNumber,
      customerName: order.user?.name || 'Unknown',
      oldStatus,
      newStatus: status,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating order status'
    });
  }
};

// @desc    Get user orders
// @route   GET /api/orders/my-orders
// @access  Private
export const getUserOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments({ user: req.user._id });

    res.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user orders'
    });
  }
};

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this order'
      });
    }

    // Check if order can be cancelled
    if (order.orderStatus === 'delivered' || order.orderStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled'
      });
    }

    order.orderStatus = 'cancelled';
    
    // Restore product stock quantities
    await Promise.all(
      order.orderItems.map(async (item) => {
        const product = await Product.findById(item.product);
        if (product) {
          product.stockQuantity += item.quantity;
          product.inStock = true;
          await product.save();
        }
      })
    );

    const updatedOrder = await order.save();

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling order'
    });
  }
};

// @desc    Create COD order
// @route   POST /api/orders/cod
// @access  Private
export const createCODOrder = async (req, res) => {
  try {
    const {
      items,
      shippingAddress,
      itemsPrice,
      shippingPrice,
      totalPrice,
      notes
    } = req.body;

    // Validate required fields
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No order items provided'
      });
    }

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Shipping address is required'
      });
    }

    // Validate shipping address required fields
    const requiredAddressFields = ['fullName', 'phone', 'email', 'street', 'city', 'state', 'zipCode'];
    for (const field of requiredAddressFields) {
      if (!shippingAddress[field]) {
        return res.status(400).json({
          success: false,
          message: `Shipping address ${field} is required`
        });
      }
    }

    // Verify products exist and get current details
    const orderItemsWithDetails = await Promise.all(
      items.map(async (item) => {
        // Validate item structure
        if (!item.product || !item.quantity || !item.price) {
          throw new Error('Invalid item structure - product, quantity, and price are required');
        }

        // Check if product ID is a valid MongoDB ObjectId format
        const mongoose = await import('mongoose');
        if (!mongoose.default.Types.ObjectId.isValid(item.product)) {
          throw new Error(`Invalid product ID format: ${item.product}. Please ensure products are properly selected.`);
        }

        const product = await Product.findById(item.product);
        if (!product) {
          throw new Error(`Product not found: ${item.product}`);
        }
        
        if (!product.inStock || product.stockQuantity < item.quantity) {
          throw new Error(`Product "${product.name}" is out of stock or insufficient quantity available`);
        }

        return {
          product: item.product,
          name: product.name,
          image: product.image || product.images?.[0]?.url || '/placeholder.svg',
          price: product.price, // Use current product price, not cart price
          quantity: item.quantity
        };
      })
    );

    // Calculate actual total from current product prices
    const calculatedItemsPrice = orderItemsWithDetails.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const calculatedTotal = calculatedItemsPrice + (shippingPrice || 0);

    const order = new Order({
      user: req.user._id,
      items: orderItemsWithDetails,
      shippingAddress,
      paymentMethod: 'COD',
      itemsPrice: calculatedItemsPrice, // Use calculated price to prevent tampering
      shippingPrice: shippingPrice || 0,
      totalPrice: calculatedTotal, // Use calculated total
      total: calculatedTotal, // Ensure both fields are set
      notes,
      status: 'pending',
      isPaid: false, // COD orders are unpaid initially
      tracking: {
        trackingNumber: `PJA${Date.now()}${Math.floor(Math.random() * 1000)}`,
        carrier: 'Panditji Auto Connect Delivery',
        estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        currentLocation: 'Order Processing Center',
        statusHistory: [{
          status: 'Order Placed (COD)',
          location: 'Order Processing Center',
          timestamp: new Date(),
          description: 'Your COD order has been placed successfully and is being processed.'
        }]
      }
    });

    const createdOrder = await order.save();

    // Update product stock quantities with error handling
    try {
      await Promise.all(
        orderItemsWithDetails.map(async (item) => {
          const product = await Product.findById(item.product);
          if (product) {
            product.stockQuantity -= item.quantity;
            if (product.stockQuantity <= 0) {
              product.inStock = false;
            }
            await product.save();
          }
        })
      );
    } catch (stockError) {
      console.error('Error updating stock quantities:', stockError);
      // Order is created, but stock update failed - log for admin review
    }

    // Populate order with related data
    await createdOrder.populate([
      { path: 'items.product', select: 'name price image images' },
      { path: 'user', select: 'name email phone' }
    ]);

    res.status(201).json({
      success: true,
      message: 'COD order created successfully',
      order: createdOrder
    });
  } catch (error) {
    console.error('Create COD order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while creating order'
    });
  }
};

// @desc    Get order tracking information
// @route   GET /api/orders/:id/tracking
// @access  Private
export const getOrderTracking = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns the order or is admin
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this order'
      });
    }

    res.json({
      success: true,
      tracking: {
        orderId: order._id,
        trackingNumber: order.tracking?.trackingNumber,
        carrier: order.tracking?.carrier,
        status: order.status,
        estimatedDelivery: order.tracking?.estimatedDelivery,
        currentLocation: order.tracking?.currentLocation,
        statusHistory: order.tracking?.statusHistory || []
      }
    });
  } catch (error) {
    console.error('Get order tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tracking information'
    });
  }
};

// @desc    Update order tracking
// @route   PUT /api/orders/:id/tracking
// @access  Private/Admin
export const updateOrderTracking = async (req, res) => {
  try {
    const { status, location, description } = req.body;
    
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update status
    if (status) {
      order.status = status;
    }

    // Update current location
    if (location) {
      order.tracking.currentLocation = location;
    }

    // Add to status history
    const newStatus = {
      status: status || order.status,
      location: location || order.tracking.currentLocation,
      timestamp: new Date(),
      description: description || `Order status updated to ${status || order.status}`
    };

    if (!order.tracking.statusHistory) {
      order.tracking.statusHistory = [];
    }
    
    order.tracking.statusHistory.push(newStatus);

    // Update delivery status
    if (status === 'delivered') {
      order.isDelivered = true;
      order.deliveredAt = new Date();
    }

    const updatedOrder = await order.save();

    res.json({
      success: true,
      message: 'Order tracking updated successfully',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Update order tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating tracking information'
    });
  }
};
