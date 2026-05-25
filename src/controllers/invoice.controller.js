const prisma = require('../utils/prisma');
const { streamInvoicePDF } = require('../services/invoice.service');

const downloadInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    // Validate that the invoice exists in the database
    const invoice = await prisma.invoice.findFirst({
      where: { invoiceNumber: invoiceId },
      include: {
        payment: true,
        user: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    // Ensure logged-in user can only download their own invoice
    if (req.user.role !== 'admin' && invoice.userId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Unauthorized to download this invoice" });
    }

    const invoiceData = {
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.createdAt || new Date(),
      paymentId: invoice.payment?.merchantTransactionId || invoice.paymentId,
      studentName: `${invoice.user.firstName} ${invoice.user.lastName}`,
      email: invoice.user.email,
      amount: invoice.amount
    };

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${invoiceId}.pdf`);

    await streamInvoicePDF(invoiceData, res);

  } catch (error) {
    console.error("Download invoice error:", error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  }
};

module.exports = { downloadInvoice };
