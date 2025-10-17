const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  total: { type: Number, required: true },
  shippingAddress: { type: String },
  shippingInfo: {
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String },
    city: { type: String },
    pincode: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
