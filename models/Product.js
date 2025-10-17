const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  category: { type: String, default: 'Accessories' }, // Engine, Brakes, Electrical, Accessories, Body Parts, Mirrors, Lights
  price: { type: Number, required: true }, // Selling price (for backward compatibility)
  costPrice: { type: Number, default: 0 }, // Purchase/Cost price for profit calculation
  sellingPrice: { type: Number }, // Explicit selling price (if different from price)
  stock: { type: Number, required: true, default: 0 },
  image_url: { type: String }, // Primary image URL
  images: [{ type: String }], // Array of Cloudinary URLs for multiple images
}, { timestamps: true });

// Virtual field to get effective selling price
productSchema.virtual('effectiveSellingPrice').get(function() {
  return this.sellingPrice || this.price;
});

module.exports = mongoose.model('Product', productSchema);
