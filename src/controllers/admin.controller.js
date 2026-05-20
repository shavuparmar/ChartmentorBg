const prisma = require('../utils/prisma');

const getDashboardAnalytics = async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalRevenue = await prisma.payment.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amount: true }
    });
    const recentPayments = await prisma.payment.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });
    
    res.json({
      success: true,
      data: {
        totalUsers,
        totalRevenue: totalRevenue._sum.amount || 0,
        recentPayments
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStudents = async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      include: { membership: true, payments: true }
    });
    res.json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPayments = async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      include: { user: true, invoice: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const sendNotification = async (req, res) => {
  try {
    const { title, message } = req.body;
    
    const notification = await prisma.notification.create({
      data: { title, message }
    });

    const users = await prisma.user.findMany();
    
    const userNotifications = users.map(user => ({
      userId: user.id,
      notificationId: notification.id
    }));

    await prisma.notificationRead.createMany({
      data: userNotifications
    });
    
    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { discordLink, telegramLink } = req.body;
    
    let settings = await prisma.settings.findFirst();
    if (settings) {
      settings = await prisma.settings.update({
        where: { id: settings.id },
        data: { discordLink, telegramLink }
      });
    } else {
      settings = await prisma.settings.create({
        data: { discordLink, telegramLink }
      });
    }
    
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getSupportTickets = async (req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      include: { user: true, replies: { include: { user: true } } },
      orderBy: { updatedAt: 'desc' }
    });
    res.json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const replySupportTicketAdmin = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    
    const reply = await prisma.supportReply.create({
      data: {
        ticketId,
        userId: req.user.id,
        message
      }
    });

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { updatedAt: new Date(), status: 'IN_PROGRESS' }
    });
    
    res.json({ success: true, data: reply });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const closeSupportTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const ticket = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'CLOSED', updatedAt: new Date() }
    });
    
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboardAnalytics,
  getStudents,
  getPayments,
  sendNotification,
  updateSettings,
  getSupportTickets,
  replySupportTicketAdmin,
  closeSupportTicket
};
