const User = require('../models/User');

/**
 * Creates default admin user if it doesn't exist
 * Reads credentials from environment variables
 */
const seedAdminUser = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@mahalaxmi.com';
    const adminName = process.env.ADMIN_NAME || 'Admin';
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.log('⚠️  ADMIN_PASSWORD not set in .env - skipping admin creation');
      return;
    }

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists:', adminEmail);
      return;
    }

    // Create admin user (password will be hashed by User model's pre-save hook)
    const adminUser = new User({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: 'admin'
    });

    await adminUser.save();
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
    console.log('⚠️  Please change the password after first login!');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  }
};

module.exports = seedAdminUser;
