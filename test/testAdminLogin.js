import fetch from 'node-fetch';

const testAdminLogin = async () => {
  try {
    console.log('🧪 Testing admin login API...');
    
    const loginData = {
      email: 'abhishek@gmail.com',
      password: 'Abhi@1234'
    };

    console.log('📧 Attempting admin login with:', loginData.email);
    
    const response = await fetch('http://localhost:5004/api/auth/admin-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData)
    });

    const result = await response.text();
    
    console.log('📊 Response status:', response.status);
    console.log('📄 Response:', result);

    if (response.ok) {
      const data = JSON.parse(result);
      console.log('✅ Admin login successful!');
      console.log('👤 User role:', data.data?.role);
      console.log('📧 User email:', data.data?.email);
      console.log('👨‍💼 User name:', data.data?.name);
      console.log('🎯 Token received:', data.data?.token ? 'Yes' : 'No');
      console.log('');
      console.log('🚀 You can now access the admin panel!');
      console.log('🌐 Admin Panel URL: http://localhost:8080/admin');
    } else {
      console.log('❌ Admin login failed');
      console.log('Error details:', result);
    }

  } catch (error) {
    console.error('❌ Test error:', error.message);
    console.log('💡 Make sure the backend server is running on port 5004');
  }
};

// Test the admin login
testAdminLogin();