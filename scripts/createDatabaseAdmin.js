import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

// Load environment variables
dotenv.config();

const createDatabaseAdmin = async () => {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/panditji-auto-connect');
    console.log('✅ Connected to MongoDB');

    // Remove any existing admin users first
    console.log('🧹 Removing existing admin users...');
    await User.deleteMany({ role: 'admin' });
    console.log('✅ Existing admin users removed');

    // Admin credentials from environment
    const adminCredentials = {
      name: 'Abhishek Admin',
      email: process.env.ADMIN_EMAIL || 'abhishek@gmail.com',
      password: process.env.ADMIN_PASSWORD || 'Abhi@1234',
      role: 'admin',
      phone: '+91 9876543210',
      isEmailVerified: true,
      profile: {
        bio: 'System Administrator for Panditji Auto Connect',
        website: 'https://panditjiautoconnect.com',
        location: 'Mumbai, Maharashtra, India'
      },
      preferences: {
        emailNotifications: true,
        smsNotifications: true,
        newsletter: false
      }
    };

    console.log('🔐 Creating admin user in database...');
    
    // Hash password using the same method as User model
    const salt = await bcryptjs.genSalt(12);
    const hashedPassword = await bcryptjs.hash(adminCredentials.password, salt);

    // Create admin user
    const adminUser = new User({
      ...adminCredentials,
      password: hashedPassword
    });

    const savedAdmin = await adminUser.save();

    console.log('🎉 Admin user created successfully in database!');
    console.log('');
    console.log('📋 ADMIN CREDENTIALS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email:', adminCredentials.email);
    console.log('🔑 Password:', adminCredentials.password);
    console.log('👤 Role: admin');
    console.log('🆔 Database ID:', savedAdmin._id.toString());
    console.log('📱 Phone:', adminCredentials.phone);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🚀 You can now login to the admin portal at:');
    console.log('🌐 Frontend: http://localhost:8080/login');
    console.log('🌐 Admin Panel: http://localhost:8080/admin');
    console.log('');

    // Test login credentials
    console.log('🧪 Testing login credentials...');
    const testUser = await User.findOne({ email: adminCredentials.email });
    if (testUser) {
      const isPasswordValid = await testUser.matchPassword(adminCredentials.password);
      if (isPasswordValid && testUser.role === 'admin') {
        console.log('✅ Database admin user validation successful!');
        console.log('✅ Password verification: PASSED');
        console.log('✅ Admin role verification: PASSED');
      } else {
        console.log('❌ Admin user validation failed!');
        console.log('Password valid:', isPasswordValid);
        console.log('Role:', testUser.role);
      }
    } else {
      console.log('❌ Admin user not found in database!');
    }

  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    if (error.code === 11000) {
      console.log('⚠️  User with this email already exists');
    }
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
createDatabaseAdmin();