// WhatsApp notification utility using Twilio
// Install: npm install twilio

const sendWhatsAppNotification = async (orderData) => {
  try {
    // Check if Twilio credentials are configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.log('⚠️ WhatsApp notifications disabled (Twilio not configured)');
      return { success: false, message: 'Twilio not configured' };
    }

    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // Format order items for message
    const itemsList = orderData.items
      .map((item, index) => `${index + 1}. ${item.productName} - Qty: ${item.quantity} - ₹${item.price}`)
      .join('\n');

    // Create WhatsApp message
    const message = `
🛍️ *New Order Received!*

📋 *Order Details:*
Order ID: #${orderData.orderId.slice(-8)}

👤 *Customer:*
Name: ${orderData.customerName}
Phone: ${orderData.customerPhone}
Email: ${orderData.customerEmail}

📦 *Items:*
${itemsList}

💰 *Total Amount:* ₹${orderData.total}

📍 *Delivery Address:*
${orderData.shippingAddress}

⏰ Order Time: ${new Date(orderData.createdAt).toLocaleString('en-IN')}

🔗 View order details in admin panel.
    `.trim();

    // Send to admin's WhatsApp
    const adminNumber = process.env.ADMIN_WHATSAPP_NUMBER;
    if (adminNumber) {
      await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: `whatsapp:${adminNumber}`,
        body: message
      });
      console.log('✅ WhatsApp notification sent to admin:', adminNumber);
    }

    // Send confirmation to customer's WhatsApp
    const customerNumber = orderData.customerPhone;
    if (customerNumber && customerNumber.length >= 10) {
      const customerMessage = `
🎉 *Order Confirmed!*

Dear ${orderData.customerName},

Thank you for your order! 🙏

📋 *Order ID:* #${orderData.orderId.slice(-8)}

📦 *Items:*
${itemsList}

💰 *Total:* ₹${orderData.total}

📍 *Delivery Address:*
${orderData.shippingAddress}

We will contact you shortly to confirm your order.

Thank you for shopping with us! 🛍️
      `.trim();

      await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: `whatsapp:+91${customerNumber.replace(/\D/g, '').slice(-10)}`,
        body: customerMessage
      });
      console.log('✅ WhatsApp confirmation sent to customer:', customerNumber);
    }

    return { success: true, message: 'WhatsApp notifications sent' };
  } catch (error) {
    console.error('❌ WhatsApp notification error:', error.message);
    return { success: false, message: error.message };
  }
};

module.exports = { sendWhatsAppNotification };
