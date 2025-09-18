import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';
import Category from './models/Category.js';
import User from './models/User.js';
import connectDB from './config/database.js';
import logger from './config/logger.js';

dotenv.config();

const sampleCategories = [
  { name: 'Engine Parts', description: 'Engine components and accessories' },
  { name: 'Brake System', description: 'Brake pads, discs, and related components' },
  { name: 'Electrical', description: 'Electrical components and accessories' },
  { name: 'Filters', description: 'Air, oil, and fuel filters' },
  { name: 'Transmission', description: 'Transmission parts and fluids' },
  { name: 'Suspension', description: 'Suspension components and parts' }
];

const sampleProducts = [
  {
    name: 'Premium Brake Pads Set',
    description: 'High-quality ceramic brake pads for superior stopping power and durability. Compatible with most sedan models.',
    price: 2499,
    originalPrice: 2999,
    brand: 'AutoMax',
    stockQuantity: 25,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400',
    features: ['Ceramic material', 'Low noise', 'Long lasting', 'OEM quality'],
    tags: ['brake', 'ceramic', 'premium'],
    isFeatured: true,
    weight: 2.5,
    warranty: { duration: 12, type: 'months' }
  },
  {
    name: 'Engine Oil Filter',
    description: 'High-efficiency oil filter for optimal engine protection. Removes contaminants and extends engine life.',
    price: 299,
    brand: 'FilterPro',
    stockQuantity: 50,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400',
    features: ['High filtration efficiency', 'Durable construction', 'Easy installation'],
    tags: ['filter', 'oil', 'engine'],
    weight: 0.3
  },
  {
    name: 'LED Headlight Bulbs',
    description: 'Ultra-bright LED headlight bulbs with 6000K color temperature. Energy efficient and long-lasting.',
    price: 1899,
    originalPrice: 2299,
    brand: 'BrightLite',
    stockQuantity: 15,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    features: ['6000K white light', 'Energy efficient', 'Long lifespan', 'Easy installation'],
    tags: ['led', 'headlight', 'bulb'],
    isFeatured: true,
    weight: 0.2,
    warranty: { duration: 24, type: 'months' }
  },
  {
    name: 'Air Filter',
    description: 'High-performance air filter for improved engine breathing and fuel efficiency.',
    price: 599,
    brand: 'AirFlow',
    stockQuantity: 30,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400',
    features: ['High airflow', 'Reusable', 'Performance enhancement'],
    tags: ['filter', 'air', 'performance'],
    weight: 0.5
  },
  {
    name: 'Shock Absorbers (Pair)',
    description: 'Premium gas-filled shock absorbers for smooth ride and improved handling.',
    price: 4999,
    originalPrice: 5999,
    brand: 'RideSmooth',
    stockQuantity: 8,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400',
    features: ['Gas-filled', 'Improved handling', 'Comfort ride', 'Durable'],
    tags: ['suspension', 'shock', 'comfort'],
    isFeatured: true,
    weight: 3.2,
    warranty: { duration: 18, type: 'months' }
  },
  {
    name: 'Transmission Fluid',
    description: 'Premium automatic transmission fluid for smooth gear shifts and transmission protection.',
    price: 899,
    brand: 'TransMax',
    stockQuantity: 20,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=400',
    features: ['Smooth shifting', 'Temperature stable', 'Long lasting'],
    tags: ['transmission', 'fluid', 'automatic'],
    weight: 1.0
  }
];

async function seedDatabase() {
  try {
    await connectDB();
    
    logger.info('Starting database seeding...');

    // Clear existing data
    await Product.deleteMany({});
    await Category.deleteMany({});
    logger.info('Cleared existing products and categories');

    // Create categories
    const categories = await Category.insertMany(sampleCategories);
    logger.info(`Created ${categories.length} categories`);

    // Create category mapping
    const categoryMap = {
      'Engine Parts': categories.find(c => c.name === 'Engine Parts')._id,
      'Brake System': categories.find(c => c.name === 'Brake System')._id,
      'Electrical': categories.find(c => c.name === 'Electrical')._id,
      'Filters': categories.find(c => c.name === 'Filters')._id,
      'Transmission': categories.find(c => c.name === 'Transmission')._id,
      'Suspension': categories.find(c => c.name === 'Suspension')._id
    };

    // Assign categories to products
    const productsWithCategories = sampleProducts.map((product, index) => {
      let categoryId;
      switch (index) {
        case 0: categoryId = categoryMap['Brake System']; break;
        case 1: categoryId = categoryMap['Filters']; break;
        case 2: categoryId = categoryMap['Electrical']; break;
        case 3: categoryId = categoryMap['Filters']; break;
        case 4: categoryId = categoryMap['Suspension']; break;
        case 5: categoryId = categoryMap['Transmission']; break;
        default: categoryId = categoryMap['Engine Parts'];
      }
      
      return {
        ...product,
        category: categoryId,
        isActive: true
      };
    });

    // Create products
    const products = await Product.insertMany(productsWithCategories);
    logger.info(`Created ${products.length} products`);

    // Create admin user if doesn't exist
    const adminExists = await User.findOne({ email: 'admin@panditjiautoconnect.com' });
    if (!adminExists) {
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.default.hash('admin123', 10);
      
      await User.create({
        name: 'Admin User',
        email: 'admin@panditjiautoconnect.com',
        password: hashedPassword,
        role: 'admin',
        isActive: true
      });
      logger.info('Created admin user');
    }

    logger.info('Database seeding completed successfully!');
    logger.info('Admin credentials: admin@panditjiautoconnect.com / admin123');
    
  } catch (error) {
    logger.error('Error seeding database:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Check if this file is being run directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  seedDatabase();
}

export default seedDatabase;