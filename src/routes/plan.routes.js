const express = require('express');
const { createPlan, getPlans, deletePlan } = require('../controllers/plan.controller');
const { authMiddleware } = require('../middlewares/auth');
const router = express.Router();

router.get('/', getPlans);
router.post('/', authMiddleware, createPlan);
router.delete('/:id', authMiddleware, deletePlan);

module.exports = router;
