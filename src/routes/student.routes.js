const express = require('express');
const {
  getDashboard,
  getNotifications,
  getSettings,
  createSupportTicket,
  getSupportTickets,
  replySupportTicket
} = require('../controllers/student.controller');
const { authMiddleware } = require('../middlewares/auth');
const router = express.Router();

router.use(authMiddleware);

router.get('/dashboard', getDashboard);
router.get('/notifications', getNotifications);
router.get('/settings', getSettings);
router.get('/support-tickets', getSupportTickets);
router.post('/support-tickets', createSupportTicket);
router.post('/support-tickets/:ticketId/reply', replySupportTicket);

module.exports = router;
