const prisma = require('../utils/prisma');

const getDashboard = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        membership: true
      }
    });
    
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notificationRead.findMany({
      where: { userId: req.user.id },
      include: { notification: true },
      orderBy: { notification: { createdAt: 'desc' } }
    });
    
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getSettings = async (req, res) => {
  try {
    const settings = await prisma.settings.findFirst();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createSupportTicket = async (req, res) => {
  try {
    const { subject, message } = req.body;
    
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: req.user.id,
        subject,
        replies: {
          create: {
            userId: req.user.id,
            message
          }
        }
      },
      include: {
        replies: true
      }
    });
    
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getSupportTickets = async (req, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: req.user.id },
      include: { replies: true },
      orderBy: { updatedAt: 'desc' }
    });
    
    res.json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const replySupportTicket = async (req, res) => {
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
      data: { updatedAt: new Date() }
    });
    
    res.json({ success: true, data: reply });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    
    // id is notificationId, we need to update NotificationRead where userId = req.user.id
    const updated = await prisma.notificationRead.updateMany({
      where: { 
        userId: req.user.id,
        notificationId: id
      },
      data: { isRead: true }
    });

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboard,
  getNotifications,
  markNotificationRead,
  getSettings,
  createSupportTicket,
  getSupportTickets,
  replySupportTicket
};
