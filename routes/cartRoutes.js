const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', cartController.getCart);
router.post('/', cartController.addToCart);
router.patch('/', cartController.updateCartItem);
router.delete('/:product_id', cartController.removeCartItem);
router.delete('/', cartController.removeCartItem);
router.post('/clear', cartController.clearCart);

module.exports = router;
