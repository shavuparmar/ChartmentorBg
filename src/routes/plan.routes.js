const express = require('express');
const { createPlan, getPlans, updatePlan, deletePlan } = require('../controllers/plan.controller');
const { authMiddleware } = require('../middlewares/auth');
const router = express.Router();

router.get('/', getPlans);
router.post('/', authMiddleware, createPlan);
router.put('/:id', authMiddleware, updatePlan);
router.delete('/:id', authMiddleware, deletePlan);

module.exports = router;
