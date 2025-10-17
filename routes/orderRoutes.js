const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', orderController.getOrders);
router.get('/all', orderController.getOrders); // Alias for clarity (admin gets all)
router.post('/', orderController.createOrder);
router.patch('/:orderId', orderController.updateOrderStatus);

module.exports = router;
