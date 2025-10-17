const mongoose = require('mongoose');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { sendWhatsAppNotification } = require('../utils/whatsappNotification');

exports.getOrders = async (req, res) => {
  try {
    let orders;
    
    // if admin, return all orders with populated items
    if (req.user.role === 'admin') {
      orders = await Order.find().populate('user_id');
    } else {
      orders = await Order.find({ user_id: req.user._id });
    }
    
    // Populate order items for each order
    for (let order of orders) {
      const orderItems = await OrderItem.find({ order_id: order._id }).populate('product_id');
      order._doc.items = orderItems; // Add items to the order object
    }
    
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: 'Get orders error', error: err.message });
  }
};

exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    console.log('🛒 Creating order for user:', req.user._id);
    console.log('📋 Shipping info received:', req.body.shippingInfo);
    
    // Populate cart items with product details
    const cart = await Cart.findOne({ user_id: req.user._id })
      .populate('items.product_id')
      .session(session);
    
    console.log('📦 Cart found:', cart ? 'YES' : 'NO');
    if (cart) {
      console.log('📦 Cart items count:', cart.items.length);
      console.log('📦 Cart items:', JSON.stringify(cart.items, null, 2));
    }
    
    if (!cart || cart.items.length === 0) {
      await session.abortTransaction();
      session.endSession();
      console.log('❌ Cart is empty');
      return res.status(400).json({ message: 'Cart is empty. Please add items to your cart first.' });
    }
    
    console.log('📦 Cart items:', cart.items.length);
    
    // Validate stock and products
    for (const item of cart.items) {
      if (!item.product_id) {
        console.log('❌ Invalid product in cart item:', item);
        throw new Error('Invalid product in cart');
      }
      const product = await Product.findById(item.product_id._id).session(session);
      if (!product) {
        console.log('❌ Product not found:', item.product_id._id);
        throw new Error('Product not found: ' + item.product_id._id);
      }
      if (product.stock < item.quantity) {
        console.log('❌ Insufficient stock:', product.name, 'Available:', product.stock, 'Requested:', item.quantity);
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
      }
      console.log(`✅ Validated: ${product.name} - Stock: ${product.stock}, Order: ${item.quantity}`);
    }
    // Deduct stock and calculate total
    let total = 0;
    for (const item of cart.items) {
      const product = await Product.findById(item.product_id._id).session(session);
      product.stock -= item.quantity;
      await product.save({ session });
      
      const itemPrice = product.sellingPrice || product.price || 0;
      total += itemPrice * item.quantity;
      console.log(`💰 ${product.name}: ₹${itemPrice} x ${item.quantity} = ₹${itemPrice * item.quantity}`);
    }
    
    console.log(`💵 Total Order Value: ₹${total}`);
    
    // Get shipping info from request
    const { shippingInfo } = req.body;
    
    // Create order with shipping info
    const order = await Order.create([{ 
      user_id: req.user._id, 
      status: 'pending', // Start with pending status
      total,
      shippingAddress: shippingInfo ? 
        `${shippingInfo.address}, ${shippingInfo.city}, ${shippingInfo.pincode}` : 
        'N/A',
      shippingInfo: shippingInfo || {}
    }], { session });
    
    const orderDoc = order[0];
    console.log(`📋 Order created: ${orderDoc._id}`);
    
    // Create order items with historical pricing
    const orderItems = [];
    for (const item of cart.items) {
      const product = await Product.findById(item.product_id._id).session(session);
      orderItems.push({
        order_id: orderDoc._id, 
        product_id: product._id, 
        quantity: item.quantity, 
        price: product.sellingPrice || product.price || 0,
        costPrice: product.costPrice || 0,
        productName: product.name
      });
    }
    
    await OrderItem.insertMany(orderItems, { session });
    console.log(`✅ Created ${orderItems.length} order items`);
    
    // Clear cart after successful order
    await Cart.findOneAndDelete({ user_id: req.user._id }).session(session);
    console.log('🧹 Cart cleared');

    await session.commitTransaction();
    session.endSession();

    // Emit stock updates and new order notification via Socket.io
    const io = req.app.get('io');
    if (io) {
      // Emit stock updates
      for (const item of orderItems) {
        const p = await Product.findById(item.product_id);
        io.emit('stock_update', { productId: p._id, stock: p.stock });
      }

      // Emit new order notification to admin
      io.emit('new_order', {
        orderId: orderDoc._id,
        customerName: shippingInfo?.name || req.user.name,
        customerEmail: shippingInfo?.email || req.user.email,
        customerPhone: shippingInfo?.phone || 'N/A',
        total: total,
        itemCount: orderItems.length,
        totalQuantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        items: orderItems.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          price: item.price
        })),
        shippingAddress: orderDoc.shippingAddress,
        createdAt: orderDoc.createdAt,
        message: `🎉 New order from ${shippingInfo?.name || req.user.name} - ₹${total}`
      });
      console.log('📡 Real-time notification sent to admin');
    }

    // Send WhatsApp notifications (async, don't wait)
    sendWhatsAppNotification({
      orderId: orderDoc._id,
      customerName: shippingInfo?.name || req.user.name,
      customerEmail: shippingInfo?.email || req.user.email,
      customerPhone: shippingInfo?.phone || '',
      total: total,
      items: orderItems,
      shippingAddress: orderDoc.shippingAddress,
      createdAt: orderDoc.createdAt
    }).catch(err => console.error('WhatsApp notification failed:', err.message));

    console.log('✅ Order placement successful!');
    res.status(201).json({ 
      message: 'Order placed successfully!',
      order: orderDoc,
      orderItems: orderItems.length
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('❌ Order creation failed:', err.message);
    res.status(400).json({ message: 'Create order error', error: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    console.log('📝 Updating order status:', orderId, 'to', status);
    
    // Validate status
    const validStatuses = ['pending', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid status. Must be one of: pending, completed, cancelled' 
      });
    }
    
    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    
    // Check permissions (only admin or order owner can update)
    if (req.user.role !== 'admin' && order.user_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }
    
    // Update order status
    order.status = status;
    await order.save();
    
    console.log('✅ Order status updated successfully');
    res.json({ 
      message: 'Order status updated successfully',
      order 
    });
  } catch (err) {
    console.error('❌ Update order status error:', err.message);
    res.status(500).json({ message: 'Update order status error', error: err.message });
  }
};
