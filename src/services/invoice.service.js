const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const generateInvoicePDF = (invoiceData, filePath) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
      }

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fillColor('#000000')
         .fontSize(20)
         .text('ChartMentor', 50, 50)
         .fontSize(10)
         .text('INVOICE', 50, 75)
         .moveDown();

      // Invoice Info
      doc.fontSize(12)
         .text(`Invoice Number: ${invoiceData.invoiceNumber}`, 50, 100)
         .text(`Date: ${new Date(invoiceData.date).toLocaleDateString()}`, 50, 115)
         .text(`Payment ID: ${invoiceData.paymentId}`, 50, 130)
         .moveDown();

      // Student Info
      doc.text(`Billed To:`, 50, 160)
         .text(invoiceData.studentName, 50, 175)
         .text(invoiceData.email, 50, 190)
         .moveDown();

      // Line items
      const invoiceTableTop = 250;
      doc.fontSize(12)
         .text('Description', 50, invoiceTableTop)
         .text('Amount', 400, invoiceTableTop, { width: 90, align: 'right' });
      
      doc.moveTo(50, invoiceTableTop + 15)
         .lineTo(500, invoiceTableTop + 15)
         .stroke();

      doc.text('ChartMentor Premium Membership', 50, invoiceTableTop + 25)
         .text(`Rs. ${invoiceData.amount}`, 400, invoiceTableTop + 25, { width: 90, align: 'right' });

      doc.moveTo(50, invoiceTableTop + 45)
         .lineTo(500, invoiceTableTop + 45)
         .stroke();

      // Total
      doc.fontSize(14)
         .text('Total', 50, invoiceTableTop + 60)
         .text(`Rs. ${invoiceData.amount}`, 400, invoiceTableTop + 60, { width: 90, align: 'right' });

      // Footer
      doc.fontSize(10)
         .text('Thank you for choosing ChartMentor!', 50, 700, { align: 'center', width: 500 });

      doc.end();

      stream.on('finish', () => {
        resolve(filePath);
      });
      stream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateInvoicePDF };
