const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get('/', productController.getProducts);
router.get('/:id', productController.getProduct);

// Protected admin routes with file upload support
router.post('/', 
  authMiddleware, 
  roleMiddleware('admin'), 
  productController.uploadMiddleware,  // Handle multipart/form-data
  productController.createProduct
);

router.put('/:id', 
  authMiddleware, 
  roleMiddleware('admin'), 
  productController.uploadMiddleware,  // Handle multipart/form-data
  productController.updateProduct
);

router.delete('/:id', authMiddleware, roleMiddleware('admin'), productController.deleteProduct);

module.exports = router;
