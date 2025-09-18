import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class InvoiceService {
  constructor() {
    // Ensure invoices directory exists
    this.invoicesDir = path.join(__dirname, '../invoices');
    if (!fs.existsSync(this.invoicesDir)) {
      fs.mkdirSync(this.invoicesDir, { recursive: true });
    }
  }

  // Generate HTML invoice
  generateInvoiceHTML(order) {
    const invoiceDate = new Date();
    const dueDate = new Date(invoiceDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now

    // Calculate totals
    const subtotal = order.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = order.taxPrice || (subtotal * 0.18); // 18% GST
    const shipping = order.shippingPrice || 0;
    const total = order.totalPrice;

    const itemsHTML = order.orderItems.map((item, index) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 8px; text-align: center;">${index + 1}</td>
        <td style="padding: 12px 8px;">
          <div style="display: flex; align-items: center;">
            <img src="${item.image}" alt="${item.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px; margin-right: 10px;">
            <div>
              <div style="font-weight: 500;">${item.name}</div>
              <div style="font-size: 12px; color: #666;">Product ID: ${item.product}</div>
            </div>
          </div>
        </td>
        <td style="padding: 12px 8px; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 8px; text-align: right;">₹${item.price.toLocaleString()}</td>
        <td style="padding: 12px 8px; text-align: right; font-weight: 500;">₹${(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice - ${order.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; line-height: 1.6; color: #333; }
          .invoice-container { max-width: 800px; margin: 0 auto; background: white; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; }
          .header h1 { font-size: 28px; margin-bottom: 5px; }
          .header p { opacity: 0.9; }
          .content { padding: 30px; }
          .invoice-info { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
          .info-section h3 { color: #495057; margin-bottom: 10px; font-size: 16px; }
          .info-section p { margin-bottom: 5px; }
          .table-container { margin: 30px 0; }
          .items-table { width: 100%; border-collapse: collapse; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; }
          .items-table th { background: #f8f9fa; padding: 15px 8px; text-align: left; font-weight: 600; border-bottom: 2px solid #dee2e6; }
          .items-table td { padding: 12px 8px; }
          .totals { margin-top: 30px; }
          .totals-table { width: 100%; max-width: 400px; margin-left: auto; }
          .totals-table td { padding: 8px 0; }
          .totals-table .total-row { border-top: 2px solid #dee2e6; font-weight: bold; font-size: 16px; }
          .footer { background: #f8f9fa; padding: 20px; margin-top: 30px; border-top: 1px solid #dee2e6; }
          .footer p { margin-bottom: 8px; }
          @media print { 
            body { -webkit-print-color-adjust: exact; }
            .invoice-container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Header -->
          <div class="header">
            <h1>INVOICE</h1>
            <p>Panditji Auto Connect Private Limited</p>
          </div>

          <!-- Content -->
          <div class="content">
            <!-- Company & Invoice Info -->
            <div class="invoice-info">
              <div class="info-section">
                <h3>From:</h3>
                <p><strong>Panditji Auto Connect Pvt Ltd</strong></p>
                <p>123 Auto Parts Street</p>
                <p>Industrial Area, Phase-1</p>
                <p>Mumbai, Maharashtra 400001</p>
                <p>India</p>
                <p><strong>Phone:</strong> +91 9876543210</p>
                <p><strong>Email:</strong> ${process.env.EMAIL_FROM}</p>
                <p><strong>GST No:</strong> 27AAAAA0000A1Z5</p>
              </div>
              
              <div class="info-section">
                <h3>Invoice Details:</h3>
                <p><strong>Invoice Number:</strong> INV-${order.orderNumber}</p>
                <p><strong>Invoice Date:</strong> ${invoiceDate.toLocaleDateString('en-IN')}</p>
                <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString('en-IN')}</p>
                <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
                <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                <p style="margin-top: 10px;"><strong>Status:</strong> 
                  <span style="background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    ${order.isPaid ? 'PAID' : 'PENDING'}
                  </span>
                </p>
              </div>
            </div>

            <!-- Bill To -->
            <div class="info-section" style="margin-bottom: 30px;">
              <h3>Bill To:</h3>
              <p><strong>${order.shippingAddress.fullName || order.shippingAddress.name}</strong></p>
              <p>${order.shippingAddress.street}</p>
              <p>${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.zipCode}</p>
              <p>${order.shippingAddress.country}</p>
              <p><strong>Phone:</strong> ${order.shippingAddress.phone}</p>
              ${order.shippingAddress.email ? `<p><strong>Email:</strong> ${order.shippingAddress.email}</p>` : ''}
            </div>

            <!-- Items Table -->
            <div class="table-container">
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width: 5%; text-align: center;">#</th>
                    <th style="width: 45%;">Product Details</th>
                    <th style="width: 10%; text-align: center;">Qty</th>
                    <th style="width: 15%; text-align: right;">Unit Price</th>
                    <th style="width: 15%; text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHTML}
                </tbody>
              </table>
            </div>

            <!-- Totals -->
            <div class="totals">
              <table class="totals-table">
                <tr>
                  <td>Subtotal:</td>
                  <td style="text-align: right;">₹${subtotal.toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Shipping:</td>
                  <td style="text-align: right;">₹${shipping.toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Tax (GST 18%):</td>
                  <td style="text-align: right;">₹${tax.toLocaleString()}</td>
                </tr>
                <tr class="total-row">
                  <td><strong>Total Amount:</strong></td>
                  <td style="text-align: right;"><strong>₹${total.toLocaleString()}</strong></td>
                </tr>
              </table>
            </div>

            <!-- Payment Info -->
            ${order.paymentInfo && order.paymentInfo.transactionId ? `
              <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin-top: 30px; border-left: 4px solid #28a745;">
                <h3 style="color: #155724; margin-bottom: 10px;">Payment Information</h3>
                <p style="color: #155724; margin-bottom: 5px;"><strong>Transaction ID:</strong> ${order.paymentInfo.transactionId}</p>
                <p style="color: #155724; margin-bottom: 5px;"><strong>Payment Date:</strong> ${new Date(order.paidAt || order.createdAt).toLocaleDateString('en-IN')}</p>
                <p style="color: #155724;"><strong>Payment Status:</strong> Successfully Paid</p>
              </div>
            ` : ''}

            <!-- Terms and Conditions -->
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              <h3 style="color: #495057; margin-bottom: 15px;">Terms and Conditions:</h3>
              <div style="font-size: 12px; color: #6c757d; line-height: 1.8;">
                <p>1. Payment is due within 30 days of invoice date.</p>
                <p>2. All returns must be authorized and returned within 15 days of delivery.</p>
                <p>3. Warranty terms apply as per product specifications.</p>
                <p>4. Late payment charges of 2% per month will be applied on overdue amounts.</p>
                <p>5. Goods once sold will only be taken back if found defective.</p>
                <p>6. Subject to Mumbai jurisdiction only.</p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p style="text-align: center; font-weight: 600; margin-bottom: 10px;">Thank you for your business!</p>
            <p style="text-align: center; font-size: 12px; color: #6c757d;">
              For any queries regarding this invoice, please contact us at ${process.env.EMAIL_FROM} or call +91 9876543210
            </p>
            <p style="text-align: center; font-size: 12px; color: #6c757d; margin-top: 10px;">
              This is a computer generated invoice and does not require physical signature.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Save invoice HTML to file
  async saveInvoiceHTML(order) {
    try {
      const invoiceHTML = this.generateInvoiceHTML(order);
      const fileName = `invoice-${order.orderNumber}-${Date.now()}.html`;
      const filePath = path.join(this.invoicesDir, fileName);
      
      fs.writeFileSync(filePath, invoiceHTML);
      
      console.log(`✅ Invoice HTML generated: ${fileName}`);
      return {
        success: true,
        filePath,
        fileName,
        html: invoiceHTML
      };
    } catch (error) {
      console.error('❌ Failed to generate invoice HTML:', error);
      throw error;
    }
  }

  // Generate invoice data for API response
  generateInvoiceData(order) {
    const invoiceDate = new Date();
    const dueDate = new Date(invoiceDate.getTime() + (30 * 24 * 60 * 60 * 1000));

    return {
      invoiceNumber: `INV-${order.orderNumber}`,
      invoiceDate: invoiceDate.toISOString(),
      dueDate: dueDate.toISOString(),
      order: {
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        status: order.orderStatus,
        paymentMethod: order.paymentMethod,
        isPaid: order.isPaid
      },
      customer: {
        name: order.shippingAddress.fullName || order.shippingAddress.name,
        email: order.shippingAddress.email || order.user?.email,
        phone: order.shippingAddress.phone,
        address: {
          street: order.shippingAddress.street,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          zipCode: order.shippingAddress.zipCode,
          country: order.shippingAddress.country
        }
      },
      items: order.orderItems.map((item, index) => ({
        slNo: index + 1,
        productId: item.product,
        name: item.name,
        image: item.image,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.price * item.quantity
      })),
      totals: {
        subtotal: order.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        shipping: order.shippingPrice || 0,
        tax: order.taxPrice || 0,
        total: order.totalPrice
      },
      paymentInfo: order.paymentInfo || null,
      company: {
        name: 'Panditji Auto Connect Pvt Ltd',
        address: '123 Auto Parts Street, Industrial Area, Phase-1',
        city: 'Mumbai, Maharashtra 400001',
        country: 'India',
        phone: '+91 9876543210',
        email: process.env.EMAIL_FROM,
        gstNo: '27AAAAA0000A1Z5'
      }
    };
  }

  // Clean up old invoice files (older than 30 days)
  cleanupOldInvoices() {
    try {
      const files = fs.readdirSync(this.invoicesDir);
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      let deletedCount = 0;
      files.forEach(file => {
        const filePath = path.join(this.invoicesDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < thirtyDaysAgo) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });
      
      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old invoice files`);
      }
    } catch (error) {
      console.error('❌ Failed to cleanup old invoices:', error);
    }
  }
}

export default new InvoiceService();