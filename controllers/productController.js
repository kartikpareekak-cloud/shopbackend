const Product = require('../models/Product');
const cloudinary = require('../utils/cloudinary');
const multer = require('multer');
const streamifier = require('streamifier');

// multer in-memory storage for multiple images
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

exports.uploadMiddleware = upload.array('images', 10); // Support up to 10 images

/**
 * Upload images to Cloudinary
 */
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { 
        resource_type: 'image', 
        folder: 'mahalaxmi',
        transformation: [
          { width: 800, height: 800, crop: 'limit' },
          { quality: 'auto' }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

exports.createProduct = async (req, res) => {
  try {
    console.log('📝 Request body:', req.body);
    console.log('📁 Files received:', req.files?.length || 0);
    
    const { name, description, category, price, costPrice, sellingPrice, stock } = req.body;
    
    let images = [];
    let image_url = '';

    // First, check if there are existing images sent as JSON string
    if (req.body.images && typeof req.body.images === 'string') {
      try {
        const parsedImages = JSON.parse(req.body.images);
        if (Array.isArray(parsedImages)) {
          images = [...parsedImages];
        }
      } catch (e) {
        console.log('Failed to parse images JSON:', e.message);
      }
    }

    // Then, upload new images to Cloudinary
    if (req.files && req.files.length > 0) {
      console.log('☁️ Uploading', req.files.length, 'images to Cloudinary...');
      const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
      const results = await Promise.all(uploadPromises);
      const newImageUrls = results.map(r => r.secure_url);
      images = [...images, ...newImageUrls];
      console.log('✅ Upload successful! Total images:', images.length);
    }

    // Set primary image
    if (req.body.image_url) {
      image_url = req.body.image_url;
    } else if (images.length > 0) {
      image_url = images[0];
    }

    const productData = {
      name,
      description,
      category: category || 'Accessories',
      price: sellingPrice || price, // Use sellingPrice if provided, else price
      costPrice: costPrice || 0,
      sellingPrice: sellingPrice || price,
      stock: parseInt(stock) || 0,
      image_url,
      images,
    };

    console.log('💾 Creating product:', productData);
    const product = await Product.create(productData);
    console.log('✅ Product created successfully:', product._id);
    res.status(201).json(product);
  } catch (err) {
    console.error('❌ Create product error:', err);
    res.status(500).json({ message: 'Create product error', error: err.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Get products error', error: err.message });
  }
};

exports.getProduct = async (req, res) => {
  try {
    const prod = await Product.findById(req.params.id);
    if (!prod) return res.status(404).json({ message: 'Product not found' });
    res.json(prod);
  } catch (err) {
    res.status(500).json({ message: 'Get product error', error: err.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    console.log('📝 Update request body:', req.body);
    console.log('📁 Files received:', req.files?.length || 0);
    
    const { name, description, category, price, costPrice, sellingPrice, stock, image_url } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category) updateData.category = category;
    if (price !== undefined) updateData.price = price;
    if (costPrice !== undefined) updateData.costPrice = parseFloat(costPrice);
    if (sellingPrice !== undefined) {
      updateData.sellingPrice = parseFloat(sellingPrice);
      updateData.price = parseFloat(sellingPrice); // Keep price in sync
    }
    if (stock !== undefined) updateData.stock = parseInt(stock);

    // Handle existing images from req.body.images (JSON string)
    let existingImages = [];
    if (req.body.images && typeof req.body.images === 'string') {
      try {
        const parsedImages = JSON.parse(req.body.images);
        if (Array.isArray(parsedImages)) {
          existingImages = parsedImages;
        }
      } catch (e) {
        console.log('Failed to parse images JSON:', e.message);
      }
    }

    // Handle new image uploads
    if (req.files && req.files.length > 0) {
      console.log('☁️ Uploading', req.files.length, 'new images to Cloudinary...');
      const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
      const results = await Promise.all(uploadPromises);
      const newImageUrls = results.map(r => r.secure_url);
      existingImages = [...existingImages, ...newImageUrls];
      console.log('✅ Upload successful! Total images:', existingImages.length);
    }

    if (existingImages.length > 0) {
      updateData.images = existingImages;
    }

    if (image_url) {
      updateData.image_url = image_url;
    } else if (existingImages.length > 0) {
      updateData.image_url = existingImages[0];
    }

    console.log('💾 Updating product:', req.params.id, updateData);
    const updated = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: 'Product not found' });
    
    console.log('✅ Product updated successfully');
    
    // emit stock update via socket
    const io = req.app.get('io');
    io && io.emit('stock_update', { productId: updated._id, stock: updated.stock });
    
    res.json(updated);
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ message: 'Update product error', error: err.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Delete product error', error: err.message });
  }
};
