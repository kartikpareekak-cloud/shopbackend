import Product from '../models/Product.js';
import Category from '../models/Category.js';
import notificationService from '../services/notificationService.js';
import { asyncHandler } from '../middleware/enhancedErrorHandler.js';
import logger from '../config/logger.js';

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;
  const skip = (page - 1) * limit;

  // Validate pagination params
  if (page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({
      success: false,
      message: 'Invalid pagination parameters'
    });
  }

  // Build filter object
  const filter = {};
  
  if (req.query.category) {
    filter.category = req.query.category;
  }
  
  if (req.query.brand) {
    filter.brand = new RegExp(req.query.brand, 'i');
  }
  
  if (req.query.minPrice || req.query.maxPrice) {
    filter.price = {};
    if (req.query.minPrice) {
      const minPrice = parseFloat(req.query.minPrice);
      if (isNaN(minPrice) || minPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid minimum price'
        });
      }
      filter.price.$gte = minPrice;
    }
    if (req.query.maxPrice) {
      const maxPrice = parseFloat(req.query.maxPrice);
      if (isNaN(maxPrice) || maxPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid maximum price'
        });
      }
      filter.price.$lte = maxPrice;
    }
  }
  
  if (req.query.inStock === 'true') {
    filter.inStock = true;
  }

  // Add active filter to only show active products
  filter.isActive = true;

  // Build sort object
  let sort = {};
  if (req.query.sortBy) {
    const [field, order] = req.query.sortBy.split(':');
    const validSortFields = ['name', 'price', 'createdAt', 'rating.average'];
    if (validSortFields.includes(field)) {
      sort[field] = order === 'desc' ? -1 : 1;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid sort field'
      });
    }
  } else {
    sort.createdAt = -1; // Default sort by newest
  }

  const products = await Product.find(filter)
    .populate('category', 'name')
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean(); // Use lean for better performance

  const total = await Product.countDocuments(filter);

  logger.info('Products fetched', {
    page,
    limit,
    total,
    filters: filter,
    sort,
    requestId: req.id
  });

  res.json({
    success: true,
    data: products,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name description')
      .populate('reviews.user', 'name');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching product'
    });
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    price,
    originalPrice,
    category,
    brand,
    stockQuantity,
    image,
    images,
    specifications,
    features,
    tags,
    weight,
    dimensions,
    warranty
  } = req.body;

  // Validate required fields
  if (!name || !description || !price || !category) {
    return res.status(400).json({
      success: false,
      message: 'Name, description, price, and category are required'
    });
  }

  // Validate price
  if (price <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Price must be greater than 0'
    });
  }

  // Validate original price if provided
  if (originalPrice && originalPrice <= price) {
    return res.status(400).json({
      success: false,
      message: 'Original price must be greater than current price'
    });
  }

  // Check if category exists
  const categoryExists = await Category.findById(category);
  if (!categoryExists) {
    return res.status(400).json({
      success: false,
      message: 'Invalid category'
    });
  }

  const product = new Product({
    name: name.trim(),
    description: description.trim(),
    price,
    originalPrice,
    category,
    brand: brand?.trim(),
    stockQuantity: stockQuantity || 0,
    inStock: (stockQuantity || 0) > 0,
    image: image || '/placeholder.svg',
    images: images || [],
    specifications: specifications || {},
    features: features || [],
    tags: tags || [],
    weight,
    dimensions,
    warranty
  });

  const savedProduct = await product.save();
  await savedProduct.populate('category', 'name');

  // Emit socket event for real-time update
  notificationService.broadcast('product_created', {
    productId: savedProduct._id,
    productName: savedProduct.name,
    category: savedProduct.category?.name,
    price: savedProduct.price,
    timestamp: new Date()
  });

  logger.info('Product created', {
    productId: savedProduct._id,
    productName: savedProduct.name,
    adminId: req.user._id,
    requestId: req.id
  });

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: savedProduct
  });
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('category', 'name');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Emit socket event for real-time update
    notificationService.broadcast('product_updated', {
      productId: product._id,
      productName: product.name,
      category: product.category?.name,
      price: product.price,
      changes: req.body,
      timestamp: new Date()
    });

    // Check for low stock and emit alert if necessary
    if (product.stockQuantity <= 5 && product.stockQuantity > 0) {
      notificationService.emitToAdmins('low_stock_alert', {
        productId: product._id,
        productName: product.name,
        quantity: product.stockQuantity,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating product'
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Emit socket event for real-time update
    notificationService.broadcast('product_deleted', {
      productId: req.params.id,
      productName: product.name,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting product'
    });
  }
};

// @desc    Get products by category
// @route   GET /api/products/category/:categoryId
// @access  Public
export const getProductsByCategory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const products = await Product.find({ category: req.params.categoryId })
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments({ category: req.params.categoryId });

    res.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching products by category'
    });
  }
};

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
export const searchProducts = async (req, res) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Create search conditions
    const searchRegex = new RegExp(q, 'i');
    const searchConditions = {
      $or: [
        { name: { $regex: searchRegex } },
        { description: { $regex: searchRegex } },
        { brand: { $regex: searchRegex } },
        { tags: { $in: [searchRegex] } }
      ]
    };

    const products = await Product.find(searchConditions)
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(searchConditions);

    res.json(products);
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching products'
    });
  }
};

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
export const getFeaturedProducts = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;

    const products = await Product.find({ isFeatured: true })
      .populate('category', 'name')
      .sort({ 'rating.average': -1 })
      .limit(limit);

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching featured products'
    });
  }
};

// @desc    Add product review
// @route   POST /api/products/:id/reviews
// @access  Private
export const addProductReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if user already reviewed this product
    const alreadyReviewed = product.reviews.find(
      (review) => review.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product'
      });
    }

    const review = {
      user: req.user._id,
      rating: Number(rating),
      comment
    };

    product.reviews.push(review);
    product.rating.count = product.reviews.length;
    product.rating.average = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully'
    });
  } catch (error) {
    console.error('Add product review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding review'
    });
  }
};

// @desc    Get product reviews
// @route   GET /api/products/:id/reviews
// @access  Public
export const getProductReviews = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('reviews.user', 'name')
      .select('reviews rating');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: {
        reviews: product.reviews,
        rating: product.rating
      }
    });
  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching reviews'
    });
  }
};
