const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true }, // Historical selling price at time of order
  costPrice: { type: Number, default: 0 }, // Historical cost price for profit calculation
  productName: { type: String }, // Store product name for historical accuracy
}, { timestamps: true });

module.exports = mongoose.model('OrderItem', orderItemSchema);
