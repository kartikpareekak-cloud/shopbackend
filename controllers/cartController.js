const Cart = require('../models/Cart');
const Product = require('../models/Product');

exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user_id: req.user._id }).populate('items.product_id');
    res.json(cart || { user_id: req.user._id, items: [] });
  } catch (err) {
    res.status(500).json({ message: 'Get cart error', error: err.message });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const { product_id, quantity } = req.body;
    const product = await Product.findById(product_id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (quantity > product.stock) return res.status(400).json({ message: 'Requested quantity exceeds stock' });
    
    let cart = await Cart.findOne({ user_id: req.user._id });
    if (!cart) cart = await Cart.create({ user_id: req.user._id, items: [] });
    
    const idx = cart.items.findIndex(i => i.product_id.toString() === product_id);
    if (idx > -1) {
      cart.items[idx].quantity += quantity;
    } else {
      cart.items.push({ product_id, quantity });
    }
    
    await cart.save();
    
    // Populate product details before sending response
    await cart.populate('items.product_id');
    
    res.json(cart);
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ message: 'Add to cart error', error: err.message });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const { product_id, quantity } = req.body;
    const product = await Product.findById(product_id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (quantity > product.stock) return res.status(400).json({ message: 'Requested quantity exceeds stock' });
    
    const cart = await Cart.findOne({ user_id: req.user._id });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });
    
    const idx = cart.items.findIndex(i => i.product_id.toString() === product_id);
    if (idx === -1) return res.status(404).json({ message: 'Item not in cart' });
    
    cart.items[idx].quantity = quantity;
    await cart.save();
    
    // Populate product details before sending response
    await cart.populate('items.product_id');
    
    res.json(cart);
  } catch (err) {
    console.error('Update cart error:', err);
    res.status(500).json({ message: 'Update cart error', error: err.message });
  }
};

exports.removeCartItem = async (req, res) => {
  try {
    const product_id = req.params.product_id || req.body.product_id;
    
    const cart = await Cart.findOne({ user_id: req.user._id });
    if (!cart) return res.status(404).json({ message: 'Cart not found' });
    
    cart.items = cart.items.filter(i => i.product_id.toString() !== product_id);
    await cart.save();
    
    // Populate product details before sending response
    await cart.populate('items.product_id');
    
    res.json(cart);
  } catch (err) {
    console.error('Remove cart item error:', err);
    res.status(500).json({ message: 'Remove cart item error', error: err.message });
  }
};

exports.clearCart = async (req, res) => {
  try {
    await Cart.findOneAndDelete({ user_id: req.user._id });
    res.json({ message: 'Cart cleared' });
  } catch (err) {
    res.status(500).json({ message: 'Clear cart error', error: err.message });
  }
};
