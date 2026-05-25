const express = require('express');
const { createChannel, getAllChannels, updateChannel, deleteChannel, getMyChannels } = require('../controllers/channel.controller');
const { authMiddleware } = require('../middlewares/auth');
const router = express.Router();

router.get('/my-channels', authMiddleware, getMyChannels);
router.get('/', authMiddleware, getAllChannels);
router.post('/', authMiddleware, createChannel);
router.put('/:id', authMiddleware, updateChannel);
router.delete('/:id', authMiddleware, deleteChannel);

module.exports = router;
