const User = require('../models/User');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Product = require('../models/Product');

/**
 * GET /api/admin/stats
 * Returns comprehensive admin statistics
 */
exports.getAdminStats = async (req, res) => {
  try {
    // 1. Total Users
    const totalUsers = await User.countDocuments();

    // 2. Total Orders
    const totalOrders = await Order.countDocuments();

    // 3. Order Status Breakdown
    const pendingOrders = await Order.countDocuments({ orderStatus: 'Pending' });
    const deliveredOrders = await Order.countDocuments({ orderStatus: 'Delivered' });
    const cancelledOrders = await Order.countDocuments({ orderStatus: 'Cancelled' });
    const shippedOrders = await Order.countDocuments({ orderStatus: 'Shipped' });

    // 4. Revenue and Profit Calculation (only from Delivered orders)
    const deliveredOrdersList = await Order.find({ orderStatus: 'Delivered' });
    
    let totalRevenue = 0;
    let totalCost = 0;

    for (const order of deliveredOrdersList) {
      // Get order items
      const orderItems = await OrderItem.find({ order_id: order._id });
      
      for (const item of orderItems) {
        const revenue = (item.price || 0) * item.quantity;
        const cost = (item.costPrice || 0) * item.quantity;
        
        totalRevenue += revenue;
        totalCost += cost;
      }
    }

    const totalProfit = totalRevenue - totalCost;

    // 5. Low Stock Products (stock < 10)
    const lowStockProducts = await Product.find({ stock: { $lt: 10 } })
      .select('name category stock image_url')
      .sort({ stock: 1 })
      .limit(10);

    // 6. Recent Orders (last 5)
    const recentOrders = await Order.find()
      .populate('user_id', 'name email')
      .sort({ createdAt: -1 })
      .limit(5);

    // 7. Top Selling Products (by quantity sold)
    const topSellingProducts = await OrderItem.aggregate([
      {
        $group: {
          _id: '$product_id',
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: { $multiply: ['$price', '$quantity'] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 }
    ]);

    // Populate product details for top selling
    const topProducts = await Product.populate(topSellingProducts, {
      path: '_id',
      select: 'name image_url category'
    });

    // 8. Sales by Category
    const salesByCategory = await OrderItem.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'product_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          totalSales: { $sum: { $multiply: ['$price', '$quantity'] } },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      { $sort: { totalSales: -1 } }
    ]);

    // 9. Monthly Revenue (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          orderStatus: 'Delivered',
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // 10. Active Users (users with at least one order)
    const activeUsers = await Order.distinct('user_id');
    const activeUsersCount = activeUsers.length;

    // Response
    res.json({
      success: true,
      stats: {
        // User Stats
        totalUsers,
        activeUsers: activeUsersCount,
        inactiveUsers: totalUsers - activeUsersCount,

        // Order Stats
        totalOrders,
        pendingOrders,
        deliveredOrders,
        shippedOrders,
        cancelledOrders,

        // Financial Stats
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalProfit: Math.round(totalProfit * 100) / 100,
        profitMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100 * 100) / 100 : 0,

        // Inventory
        lowStockProducts,
        lowStockCount: lowStockProducts.length,

        // Recent Activity
        recentOrders,

        // Analytics
        topSellingProducts: topProducts,
        salesByCategory,
        monthlyRevenue
      }
    });

  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch admin statistics', 
      error: err.message 
    });
  }
};

/**
 * GET /api/admin/revenue-chart
 * Returns monthly revenue data for charts
 */
exports.getRevenueChart = async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const revenueData = await Order.aggregate([
      {
        $match: {
          orderStatus: 'Delivered',
          createdAt: { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: 'orderitems',
          localField: '_id',
          foreignField: 'order_id',
          as: 'items'
        }
      },
      {
        $unwind: '$items'
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          cost: { $sum: { $multiply: ['$items.costPrice', '$items.quantity'] } },
          orders: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 1,
          revenue: 1,
          cost: 1,
          profit: { $subtract: ['$revenue', '$cost'] },
          orders: 1
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Format for chart display
    const chartData = revenueData.map(item => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      revenue: Math.round(item.revenue * 100) / 100,
      cost: Math.round(item.cost * 100) / 100,
      profit: Math.round(item.profit * 100) / 100,
      orders: item.orders
    }));

    res.json({
      success: true,
      data: chartData
    });

  } catch (err) {
    console.error('Revenue chart error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch revenue chart data', 
      error: err.message 
    });
  }
};

/**
 * GET /api/admin/orders/:id
 * Get detailed order information including profit
 */
exports.getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user_id', 'name email');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const orderItems = await OrderItem.find({ order_id: order._id }).populate('product_id', 'name image_url category');

    // Calculate profit for this order
    let orderRevenue = 0;
    let orderCost = 0;

    const itemsWithProfit = orderItems.map(item => {
      const revenue = (item.price || 0) * item.quantity;
      const cost = (item.costPrice || 0) * item.quantity;
      const profit = revenue - cost;

      orderRevenue += revenue;
      orderCost += cost;

      return {
        ...item.toObject(),
        itemRevenue: revenue,
        itemCost: cost,
        itemProfit: profit
      };
    });

    const orderProfit = orderRevenue - orderCost;

    res.json({
      success: true,
      order: {
        ...order.toObject(),
        items: itemsWithProfit,
        calculatedRevenue: Math.round(orderRevenue * 100) / 100,
        calculatedCost: Math.round(orderCost * 100) / 100,
        calculatedProfit: Math.round(orderProfit * 100) / 100
      }
    });

  } catch (err) {
    console.error('Order details error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch order details', 
      error: err.message 
    });
  }
};

/**
 * PATCH /api/admin/orders/:id/status
 * Update order status
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus } = req.body;
    
    const validStatuses = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid order status' });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus, updatedAt: Date.now() },
      { new: true }
    ).populate('user_id', 'name email');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('order_status_update', { orderId: order._id, status: orderStatus });
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order
    });

  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update order status', 
      error: err.message 
    });
  }
};

/**
 * PATCH /api/admin/products/:id/restock
 * Quick restock product
 */
exports.restockProduct = async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Invalid quantity' });
    }

    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.stock += parseInt(quantity);
    await product.save();

    // Emit stock update
    const io = req.app.get('io');
    if (io) {
      io.emit('stock_update', { productId: product._id, stock: product.stock });
    }

    res.json({
      success: true,
      message: 'Product restocked successfully',
      product
    });

  } catch (err) {
    console.error('Restock product error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Failed to restock product', 
      error: err.message 
    });
  }
};

module.exports = exports;
