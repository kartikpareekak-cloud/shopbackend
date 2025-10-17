const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const adminStatsController = require('../controllers/adminStatsController');
const User = require('../models/User');
const Product = require('../models/Product');

// Protect all admin routes
router.use(protect);
router.use(adminOnly);

/**
 * Statistics & Analytics
 */
router.get('/stats', adminStatsController.getAdminStats);
router.get('/revenue-chart', adminStatsController.getRevenueChart);

/**
 * Order Management
 */
router.get('/orders/:id', adminStatsController.getOrderDetails);
router.patch('/orders/:id/status', adminStatsController.updateOrderStatus);

/**
 * Product Management
 */
router.patch('/products/:id/restock', adminStatsController.restockProduct);

/**
 * User Management
 */
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: err.message });
  }
});

router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User role updated', user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update user role', error: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    // Prevent deleting yourself
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete user', error: err.message });
  }
});

/**
 * Bulk Operations
 */
router.post('/products/bulk-delete', async (req, res) => {
  try {
    const { productIds } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No product IDs provided' });
    }

    const result = await Product.deleteMany({ _id: { $in: productIds } });
    
    res.json({ 
      success: true, 
      message: `${result.deletedCount} products deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete products', error: err.message });
  }
});

router.patch('/products/bulk-update-stock', async (req, res) => {
  try {
    const { updates } = req.body; // [{ id, stock }]
    
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No updates provided' });
    }

    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: { _id: update.id },
        update: { $set: { stock: update.stock } }
      }
    }));

    const result = await Product.bulkWrite(bulkOps);

    // Emit stock updates
    const io = req.app.get('io');
    if (io) {
      updates.forEach(update => {
        io.emit('stock_update', { productId: update.id, stock: update.stock });
      });
    }

    res.json({ 
      success: true, 
      message: `${result.modifiedCount} products updated successfully`,
      modifiedCount: result.modifiedCount
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update products', error: err.message });
  }
});

module.exports = router;
