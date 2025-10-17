const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// All admin routes require authentication and admin role
router.use(protect);
router.use(adminOnly);

// Dashboard stats
router.get('/stats', adminController.getAdminStats);
router.get('/recent-orders', adminController.getRecentOrders);
router.get('/revenue-chart', adminController.getRevenueChartData);

// User management
router.get('/users', adminController.getAllUsers);
router.put('/users/:userId/role', adminController.updateUserRole);
router.delete('/users/:userId', adminController.deleteUser);

// Order management
router.get('/orders', adminController.getAllOrders);
router.get('/orders/:orderId', adminController.getOrderDetails);
router.put('/orders/:orderId/status', adminController.updateOrderStatus);

// Product management (bulk operations)
router.put('/products/bulk-stock', adminController.bulkUpdateStock);
router.delete('/products/bulk-delete', adminController.bulkDeleteProducts);

module.exports = router;
