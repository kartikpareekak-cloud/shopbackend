const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');

/**
 * Get comprehensive admin statistics
 * Returns: totalUsers, totalOrders, totalRevenue, totalProfit, 
 * pendingOrders, deliveredOrders, lowStockProducts
 */
exports.getAdminStats = async (req, res) => {
  try {
    // Get total users
    const totalUsers = await User.countDocuments();

    // Get total orders
    const totalOrders = await Order.countDocuments();

    // Get orders by status
    const pendingOrders = await Order.countDocuments({ orderStatus: 'Pending' });
    const deliveredOrders = await Order.countDocuments({ orderStatus: 'Delivered' });
    const cancelledOrders = await Order.countDocuments({ orderStatus: 'Cancelled' });
    const shippedOrders = await Order.countDocuments({ orderStatus: 'Shipped' });

    // Calculate revenue and profit from delivered orders
    const deliveredOrdersList = await Order.find({ orderStatus: 'Delivered' }).lean();
    
    let totalRevenue = 0;
    let totalCost = 0;

    for (const order of deliveredOrdersList) {
      // Add order total to revenue
      totalRevenue += order.totalAmount || 0;

      // Get order items to calculate cost
      const orderItems = await OrderItem.find({ order_id: order._id }).lean();
      
      for (const item of orderItems) {
        // Use historical costPrice from order item, or fetch from product
        let itemCostPrice = item.costPrice || 0;
        
        if (!itemCostPrice) {
          const product = await Product.findById(item.product_id).lean();
          if (product) {
            itemCostPrice = product.costPrice || 0;
          }
        }
        
        totalCost += itemCostPrice * item.quantity;
      }
    }

    const totalProfit = totalRevenue - totalCost;

    // Get low stock products (stock < 10)
    const lowStockProducts = await Product.find({ stock: { $lt: 10 } })
      .select('name stock category')
      .sort({ stock: 1 })
      .limit(10)
      .lean();

    // Get active users (users who have placed at least one order)
    const activeUsersCount = await Order.distinct('user_id').then(ids => ids.length);

    res.json({
      totalUsers,
      activeUsers: activeUsersCount,
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      pendingOrders,
      deliveredOrders,
      shippedOrders,
      cancelledOrders,
      lowStockProducts,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ message: 'Failed to fetch admin statistics', error: err.message });
  }
};

/**
 * Get recent orders (last 5)
 */
exports.getRecentOrders = async (req, res) => {
  try {
    const recentOrders = await Order.find()
      .populate('user_id', 'name email')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Fetch order items for each order
    const ordersWithItems = await Promise.all(
      recentOrders.map(async (order) => {
        const items = await OrderItem.find({ order_id: order._id })
          .populate('product_id', 'name image_url')
          .lean();
        return { ...order, items };
      })
    );

    res.json(ordersWithItems);
  } catch (err) {
    console.error('Recent orders error:', err);
    res.status(500).json({ message: 'Failed to fetch recent orders', error: err.message });
  }
};

/**
 * Get all users with pagination
 */
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalUsers = await User.countDocuments();

    res.json({
      users,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
    });
  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({ message: 'Failed to fetch users', error: err.message });
  }
};

/**
 * Update user role (Admin only)
 */
exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be "user" or "admin"' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User role updated successfully', user });
  } catch (err) {
    console.error('Update user role error:', err);
    res.status(500).json({ message: 'Failed to update user role', error: err.message });
  }
};

/**
 * Delete user (Admin only)
 */
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Failed to delete user', error: err.message });
  }
};

/**
 * Get all orders with details
 */
exports.getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    const query = status ? { orderStatus: status } : {};

    const orders = await Order.find(query)
      .populate('user_id', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalOrders = await Order.countDocuments(query);

    // Fetch items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await OrderItem.find({ order_id: order._id })
          .populate('product_id', 'name image_url category')
          .lean();
        return { ...order, items };
      })
    );

    res.json({
      orders: ordersWithItems,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      totalOrders,
    });
  } catch (err) {
    console.error('Get all orders error:', err);
    res.status(500).json({ message: 'Failed to fetch orders', error: err.message });
  }
};

/**
 * Update order status
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderStatus } = req.body;

    const validStatuses = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({ 
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { orderStatus },
      { new: true }
    ).populate('user_id', 'name email');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Emit real-time update via socket
    const io = req.app.get('io');
    if (io) {
      io.emit('order_status_update', { 
        orderId: order._id, 
        orderStatus: order.orderStatus,
        userId: order.user_id._id 
      });
    }

    res.json({ message: 'Order status updated successfully', order });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ message: 'Failed to update order status', error: err.message });
  }
};

/**
 * Get single order details with profit calculation
 */
exports.getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate('user_id', 'name email phone address')
      .lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const items = await OrderItem.find({ order_id: order._id })
      .populate('product_id', 'name image_url category')
      .lean();

    // Calculate profit for this order
    let orderCost = 0;
    for (const item of items) {
      const costPrice = item.costPrice || 0;
      orderCost += costPrice * item.quantity;
    }

    const orderRevenue = order.totalAmount || 0;
    const orderProfit = orderRevenue - orderCost;

    res.json({
      ...order,
      items,
      orderCost: Math.round(orderCost * 100) / 100,
      orderProfit: Math.round(orderProfit * 100) / 100,
    });
  } catch (err) {
    console.error('Get order details error:', err);
    res.status(500).json({ message: 'Failed to fetch order details', error: err.message });
  }
};

/**
 * Get revenue chart data (last 7 days)
 */
exports.getRevenueChartData = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orders = await Order.find({
      orderStatus: 'Delivered',
      createdAt: { $gte: startDate }
    }).lean();

    // Group by date
    const revenueByDate = {};
    
    for (const order of orders) {
      const dateKey = order.createdAt.toISOString().split('T')[0];
      if (!revenueByDate[dateKey]) {
        revenueByDate[dateKey] = 0;
      }
      revenueByDate[dateKey] += order.totalAmount || 0;
    }

    // Convert to array format for charts
    const chartData = Object.entries(revenueByDate)
      .map(([date, revenue]) => ({
        date,
        revenue: Math.round(revenue * 100) / 100,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json(chartData);
  } catch (err) {
    console.error('Revenue chart data error:', err);
    res.status(500).json({ message: 'Failed to fetch revenue chart data', error: err.message });
  }
};

/**
 * Bulk update product stock
 */
exports.bulkUpdateStock = async (req, res) => {
  try {
    const { updates } = req.body; // Array of { productId, stock }

    if (!Array.isArray(updates)) {
      return res.status(400).json({ message: 'Updates must be an array' });
    }

    const results = await Promise.all(
      updates.map(async ({ productId, stock }) => {
        const product = await Product.findByIdAndUpdate(
          productId,
          { stock },
          { new: true }
        );
        return product;
      })
    );

    // Emit stock updates via socket
    const io = req.app.get('io');
    if (io) {
      results.forEach(product => {
        if (product) {
          io.emit('stock_update', { productId: product._id, stock: product.stock });
        }
      });
    }

    res.json({ message: 'Stock updated successfully', products: results });
  } catch (err) {
    console.error('Bulk update stock error:', err);
    res.status(500).json({ message: 'Failed to update stock', error: err.message });
  }
};

/**
 * Bulk delete products
 */
exports.bulkDeleteProducts = async (req, res) => {
  try {
    const { productIds } = req.body; // Array of product IDs

    if (!Array.isArray(productIds)) {
      return res.status(400).json({ message: 'productIds must be an array' });
    }

    const result = await Product.deleteMany({ _id: { $in: productIds } });

    res.json({ 
      message: `${result.deletedCount} products deleted successfully`,
      deletedCount: result.deletedCount 
    });
  } catch (err) {
    console.error('Bulk delete products error:', err);
    res.status(500).json({ message: 'Failed to delete products', error: err.message });
  }
};
