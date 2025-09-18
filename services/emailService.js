import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  // Test email configuration
  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email server connection successful');
      return true;
    } catch (error) {
      console.error('❌ Email server connection failed:', error);
      return false;
    }
  }

  // Send order confirmation email
  async sendOrderConfirmation(order, userEmail) {
    try {
      const emailTemplate = this.getOrderConfirmationTemplate(order);
      
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: userEmail,
        subject: `Order Confirmation - ${order.orderNumber}`,
        html: emailTemplate,
        attachments: []
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Order confirmation email sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Failed to send order confirmation email:', error);
      throw error;
    }
  }

  // Send order status update email
  async sendOrderStatusUpdate(order, userEmail, oldStatus, newStatus) {
    try {
      const emailTemplate = this.getOrderStatusUpdateTemplate(order, oldStatus, newStatus);
      
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: userEmail,
        subject: `Order Update - ${order.orderNumber}`,
        html: emailTemplate
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Order status update email sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Failed to send order status update email:', error);
      throw error;
    }
  }

  // Send invoice email with PDF attachment
  async sendInvoice(order, userEmail, invoicePdfPath) {
    try {
      const emailTemplate = this.getInvoiceEmailTemplate(order);
      
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: userEmail,
        subject: `Invoice - ${order.orderNumber}`,
        html: emailTemplate,
        attachments: [
          {
            filename: `invoice-${order.orderNumber}.pdf`,
            path: invoicePdfPath,
            contentType: 'application/pdf'
          }
        ]
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Invoice email sent:', result.messageId);
      
      // Clean up PDF file after sending
      try {
        if (fs.existsSync(invoicePdfPath)) {
          fs.unlinkSync(invoicePdfPath);
        }
      } catch (cleanupError) {
        console.warn('⚠️ Failed to cleanup PDF file:', cleanupError);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Failed to send invoice email:', error);
      throw error;
    }
  }

  // Send welcome email to new users
  async sendWelcomeEmail(user) {
    try {
      const emailTemplate = this.getWelcomeEmailTemplate(user);
      
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: 'Welcome to Panditji Auto Connect!',
        html: emailTemplate
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Welcome email sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      throw error;
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(user, resetToken) {
    try {
      const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      const emailTemplate = this.getPasswordResetTemplate(user, resetLink);
      
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: 'Password Reset Request',
        html: emailTemplate
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Password reset email sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      throw error;
    }
  }

  // Email Templates
  getOrderConfirmationTemplate(order) {
    const itemsHtml = order.orderItems.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          <img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; margin-right: 10px;">
          ${item.name}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
          ₹${item.price.toLocaleString()}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
          ₹${(item.price * item.quantity).toLocaleString()}
        </td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Order Confirmed!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Thank you for your order with Panditji Auto Connect</p>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #ddd; border-top: none;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 15px 0; color: #495057;">Order Details</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <strong>Order Number:</strong><br>
                <span style="font-family: monospace; background: #e9ecef; padding: 4px 8px; border-radius: 4px;">${order.orderNumber}</span>
              </div>
              <div>
                <strong>Order Date:</strong><br>
                ${new Date(order.createdAt).toLocaleDateString('en-IN')}
              </div>
              <div>
                <strong>Payment Method:</strong><br>
                ${order.paymentMethod}
              </div>
              <div>
                <strong>Total Amount:</strong><br>
                <span style="font-size: 18px; font-weight: bold; color: #28a745;">₹${order.totalPrice.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <h3 style="margin: 30px 0 15px 0; color: #495057;">Order Items</h3>
          <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 15px 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Product</th>
                <th style="padding: 15px 10px; text-align: center; border-bottom: 2px solid #dee2e6;">Qty</th>
                <th style="padding: 15px 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Price</th>
                <th style="padding: 15px 10px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #495057;">Shipping Address</h3>
            <div style="line-height: 1.8;">
              <strong>${order.shippingAddress.fullName || order.shippingAddress.name}</strong><br>
              ${order.shippingAddress.street}<br>
              ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}<br>
              ${order.shippingAddress.country}<br>
              <strong>Phone:</strong> ${order.shippingAddress.phone}
            </div>
          </div>

          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
            <h3 style="margin: 0 0 10px 0; color: #155724;">What's Next?</h3>
            <ul style="margin: 0; padding-left: 20px; color: #155724;">
              <li>Your order is being processed</li>
              <li>You'll receive updates via email and SMS</li>
              <li>Expected delivery: 5-7 business days</li>
              <li>Track your order anytime in your account</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0; padding: 20px;">
            <a href="${process.env.FRONTEND_URL}/orders" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">Track Your Order</a>
          </div>
        </div>

        <div style="background: #6c757d; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="margin: 0; font-size: 14px;">
            Thank you for choosing Panditji Auto Connect!<br>
            Need help? Contact us at <a href="mailto:${process.env.EMAIL_FROM}" style="color: #ffffff;">${process.env.EMAIL_FROM}</a>
          </p>
        </div>
      </body>
      </html>
    `;
  }

  getOrderStatusUpdateTemplate(order, oldStatus, newStatus) {
    const statusMessages = {
      confirmed: 'Your order has been confirmed and is being prepared.',
      processing: 'Your order is currently being processed.',
      shipped: 'Great news! Your order has been shipped and is on its way.',
      delivered: 'Your order has been successfully delivered.',
      cancelled: 'Your order has been cancelled.'
    };

    const statusColors = {
      confirmed: '#17a2b8',
      processing: '#ffc107',
      shipped: '#28a745',
      delivered: '#28a745',
      cancelled: '#dc3545'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Status Update</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: ${statusColors[newStatus] || '#6c757d'}; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Order Status Update</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Order #${order.orderNumber}</p>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #ddd; border-top: none;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
            <h2 style="margin: 0 0 15px 0; color: ${statusColors[newStatus] || '#6c757d'}; text-transform: capitalize;">
              Status: ${newStatus}
            </h2>
            <p style="margin: 0; font-size: 16px; color: #6c757d;">
              ${statusMessages[newStatus] || 'Your order status has been updated.'}
            </p>
          </div>

          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #155724;">Order Summary</h3>
            <div style="color: #155724;">
              <strong>Order Number:</strong> ${order.orderNumber}<br>
              <strong>Total Amount:</strong> ₹${order.totalPrice.toLocaleString()}<br>
              <strong>Items:</strong> ${order.orderItems.length} item(s)
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0; padding: 20px;">
            <a href="${process.env.FRONTEND_URL}/orders" style="background: ${statusColors[newStatus] || '#6c757d'}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">View Order Details</a>
          </div>
        </div>

        <div style="background: #6c757d; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="margin: 0; font-size: 14px;">
            Thank you for choosing Panditji Auto Connect!<br>
            Need help? Contact us at <a href="mailto:${process.env.EMAIL_FROM}" style="color: #ffffff;">${process.env.EMAIL_FROM}</a>
          </p>
        </div>
      </body>
      </html>
    `;
  }

  getInvoiceEmailTemplate(order) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Invoice Ready</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your invoice for order #${order.orderNumber}</p>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #ddd; border-top: none;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 15px 0; color: #495057;">Invoice Details</h2>
            <div style="color: #6c757d;">
              <strong>Order Number:</strong> ${order.orderNumber}<br>
              <strong>Invoice Date:</strong> ${new Date().toLocaleDateString('en-IN')}<br>
              <strong>Total Amount:</strong> ₹${order.totalPrice.toLocaleString()}
            </div>
          </div>

          <p style="font-size: 16px; margin-bottom: 20px;">
            Dear ${order.shippingAddress.fullName || order.shippingAddress.name},
          </p>
          
          <p style="margin-bottom: 20px;">
            Please find attached your invoice for the recent order. This invoice contains complete details of your purchase including itemized billing and tax information.
          </p>

          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
            <h3 style="margin: 0 0 10px 0; color: #155724;">Important Information</h3>
            <ul style="margin: 0; padding-left: 20px; color: #155724;">
              <li>Keep this invoice for your records</li>
              <li>This serves as proof of purchase</li>
              <li>Contact us for any billing queries</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0; padding: 20px;">
            <a href="${process.env.FRONTEND_URL}/orders" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">View Order Details</a>
          </div>
        </div>

        <div style="background: #6c757d; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="margin: 0; font-size: 14px;">
            Thank you for choosing Panditji Auto Connect!<br>
            Need help? Contact us at <a href="mailto:${process.env.EMAIL_FROM}" style="color: #ffffff;">${process.env.EMAIL_FROM}</a>
          </p>
        </div>
      </body>
      </html>
    `;
  }

  getWelcomeEmailTemplate(user) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Panditji Auto Connect</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 32px;">Welcome to Panditji Auto Connect!</h1>
          <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">Your account has been created successfully</p>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #ddd; border-top: none;">
          <h2 style="color: #495057;">Hello ${user.name}!</h2>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            Thank you for joining Panditji Auto Connect. We're excited to have you as part of our community!
          </p>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #495057;">What you can do now:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #6c757d;">
              <li>Browse our extensive catalog of auto parts</li>
              <li>Add items to your wishlist</li>
              <li>Get personalized product recommendations</li>
              <li>Track your orders in real-time</li>
              <li>Enjoy exclusive member discounts</li>
            </ul>
          </div>

          <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
            <h3 style="margin: 0 0 10px 0; color: #155724;">Get Started</h3>
            <p style="margin: 0; color: #155724;">
              Complete your profile and start shopping for the best auto parts at competitive prices!
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0; padding: 20px;">
            <a href="${process.env.FRONTEND_URL}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; margin-right: 10px;">Start Shopping</a>
            <a href="${process.env.FRONTEND_URL}/profile" style="background: transparent; color: #667eea; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block; border: 2px solid #667eea;">Update Profile</a>
          </div>
        </div>

        <div style="background: #6c757d; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="margin: 0; font-size: 14px;">
            Welcome aboard!<br>
            Need help? Contact us at <a href="mailto:${process.env.EMAIL_FROM}" style="color: #ffffff;">${process.env.EMAIL_FROM}</a>
          </p>
        </div>
      </body>
      </html>
    `;
  }

  getPasswordResetTemplate(user, resetLink) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Password Reset Request</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Reset your account password</p>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #ddd; border-top: none;">
          <h2 style="color: #495057;">Hello ${user.name},</h2>
          
          <p style="font-size: 16px; margin-bottom: 20px;">
            We received a request to reset your password for your Panditji Auto Connect account.
          </p>

          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #856404;">Security Notice</h3>
            <ul style="margin: 0; padding-left: 20px; color: #856404;">
              <li>This link will expire in 1 hour</li>
              <li>If you didn't request this, please ignore this email</li>
              <li>Never share this link with anyone</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0; padding: 20px;">
            <a href="${resetLink}" style="background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>

          <p style="font-size: 14px; color: #6c757d; margin-top: 20px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetLink}" style="color: #667eea; word-break: break-all;">${resetLink}</a>
          </p>
        </div>

        <div style="background: #6c757d; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="margin: 0; font-size: 14px;">
            Panditji Auto Connect Security Team<br>
            Need help? Contact us at <a href="mailto:${process.env.EMAIL_FROM}" style="color: #ffffff;">${process.env.EMAIL_FROM}</a>
          </p>
        </div>
      </body>
      </html>
    `;
  }
}

export default new EmailService();