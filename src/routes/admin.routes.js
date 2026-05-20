const express = require('express');
const {
  getDashboardAnalytics,
  getStudents,
  getPayments,
  sendNotification,
  updateSettings,
  getSupportTickets,
  replySupportTicketAdmin,
  closeSupportTicket
} = require('../controllers/admin.controller');
const { authMiddleware, adminMiddleware } = require('../middlewares/auth');
const router = express.Router();

router.use(authMiddleware, adminMiddleware);

router.get('/analytics', getDashboardAnalytics);
router.get('/students', getStudents);
router.get('/payments', getPayments);
router.post('/notifications', sendNotification);
router.put('/settings', updateSettings);
router.get('/support-tickets', getSupportTickets);
router.post('/support-tickets/:ticketId/reply', replySupportTicketAdmin);
router.put('/support-tickets/:ticketId/close', closeSupportTicket);

module.exports = router;
