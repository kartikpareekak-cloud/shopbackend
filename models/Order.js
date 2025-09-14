import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    image: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    }
  }],
  // Support both items and orderItems for backward compatibility
  orderItems: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: false
    },
    name: {
      type: String,
      required: false
    },
    image: {
      type: String,
      required: false
    },
    price: {
      type: Number,
      required: false
    },
    quantity: {
      type: Number,
      required: false,
      min: [1, 'Quantity must be at least 1']
    }
  }],
  shippingAddress: {
    name: {
      type: String,
      required: false
    },
    fullName: {
      type: String,
      required: false
    },
    email: {
      type: String,
      required: false
    },
    phone: {
      type: String,
      required: true
    },
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'India'
    }
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['COD', 'ONLINE']
  },
  paymentInfo: {
    razorpay_order_id: String,
    razorpay_payment_id: String,
    razorpay_signature: String,
  },
  paymentResult: {
    id: String,
    status: String,
    update_time: String,
    email_address: String
  },
  itemsPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  taxPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  shippingPrice: {
    type: Number,
    required: true,
    default: 0.0
  },
  total: {
    type: Number,
    required: true,
    default: 0.0
  },
  // Support totalPrice for frontend compatibility
  totalPrice: {
    type: Number,
    required: false,
    default: 0.0
  },
  isPaid: {
    type: Boolean,
    required: true,
    default: false
  },
  paidAt: {
    type: Date
  },
  isDelivered: {
    type: Boolean,
    required: true,
    default: false
  },
  deliveredAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  tracking: {
    trackingNumber: String,
    carrier: String,
    estimatedDelivery: Date,
    currentLocation: String,
    statusHistory: [{
      status: String,
      location: String,
      timestamp: {
        type: Date,
        default: Date.now
      },
      description: String
    }]
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot be more than 500 characters']
  }
}, {
  timestamps: true
});

// Pre-save hook to handle field mapping and validation
orderSchema.pre('save', function(next) {
  // Handle shippingAddress name field mapping
  if (this.shippingAddress) {
    // If fullName is provided but name is not, copy fullName to name
    if (this.shippingAddress.fullName && !this.shippingAddress.name) {
      this.shippingAddress.name = this.shippingAddress.fullName;
    }
    // If name is provided but fullName is not, copy name to fullName
    if (this.shippingAddress.name && !this.shippingAddress.fullName) {
      this.shippingAddress.fullName = this.shippingAddress.name;
    }
    // Ensure at least one name field is provided
    if (!this.shippingAddress.name && !this.shippingAddress.fullName) {
      return next(new Error('Shipping address must have a name or fullName'));
    }
  }

  // Handle totalPrice vs total field mapping
  if (this.totalPrice && !this.total) {
    this.total = this.totalPrice;
  } else if (this.total && !this.totalPrice) {
    this.totalPrice = this.total;
  }

  // Handle items vs orderItems field mapping
  if (this.items && this.items.length > 0 && (!this.orderItems || this.orderItems.length === 0)) {
    this.orderItems = this.items;
  } else if (this.orderItems && this.orderItems.length > 0 && (!this.items || this.items.length === 0)) {
    this.items = this.orderItems;
  }

  next();
});

export default mongoose.model('Order', orderSchema);
