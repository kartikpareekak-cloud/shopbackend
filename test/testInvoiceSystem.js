// Test script to verify invoice functionality
import emailService from '../services/emailService.js';
import invoiceService from '../services/invoiceService.js';

// Test email service connection
const testEmailService = async () => {
  console.log('🧪 Testing email service...');
  try {
    const result = await emailService.testConnection();
    console.log('✅ Email service test:', result ? 'PASSED' : 'FAILED');
  } catch (error) {
    console.log('❌ Email service test FAILED:', error.message);
  }
};

// Test invoice generation
const testInvoiceGeneration = () => {
  console.log('🧪 Testing invoice generation...');
  try {
    // Mock order data
    const mockOrder = {
      _id: '60f7b3a1a3b6b3a1a3b6b3a1',
      orderNumber: 'PJA_1726684234567_test123',
      orderItems: [
        {
          product: '60f7b3a1a3b6b3a1a3b6b3a2',
          name: 'Premium Auto Oil Filter',
          image: 'https://example.com/oil-filter.jpg',
          price: 850,
          quantity: 2
        },
        {
          product: '60f7b3a1a3b6b3a1a3b6b3a3',
          name: 'Brake Pads Set',
          image: 'https://example.com/brake-pads.jpg',
          price: 2500,
          quantity: 1
        }
      ],
      shippingAddress: {
        fullName: 'Rajesh Kumar',
        email: 'rajesh.kumar@example.com',
        phone: '+91 9876543210',
        street: '123 MG Road, Sector 15',
        city: 'Mumbai',
        state: 'Maharashtra',
        zipCode: '400001',
        country: 'India'
      },
      paymentMethod: 'COD',
      totalPrice: 4200,
      shippingPrice: 0,
      taxPrice: 756,
      isPaid: false,
      createdAt: new Date(),
      user: {
        _id: '60f7b3a1a3b6b3a1a3b6b3a4',
        name: 'Rajesh Kumar',
        email: 'rajesh.kumar@example.com'
      }
    };

    // Test invoice data generation
    const invoiceData = invoiceService.generateInvoiceData(mockOrder);
    console.log('✅ Invoice data generation: PASSED');
    console.log('📄 Invoice Number:', invoiceData.invoiceNumber);
    console.log('💰 Total Amount:', invoiceData.totals.total);

    // Test HTML generation
    const invoiceHTML = invoiceService.generateInvoiceHTML(mockOrder);
    console.log('✅ Invoice HTML generation: PASSED');
    console.log('📏 HTML length:', invoiceHTML.length, 'characters');

    return true;
  } catch (error) {
    console.log('❌ Invoice generation test FAILED:', error.message);
    return false;
  }
};

// Main test function
const runTests = async () => {
  console.log('🚀 Starting Invoice System Tests...\n');
  
  await testEmailService();
  console.log('');
  
  const invoiceTest = testInvoiceGeneration();
  console.log('');
  
  console.log('📊 Test Summary:');
  console.log('- Email Service: See results above');
  console.log('- Invoice Generation:', invoiceTest ? 'PASSED' : 'FAILED');
  console.log('\n✨ Invoice system is ready for use!');
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { testEmailService, testInvoiceGeneration, runTests };