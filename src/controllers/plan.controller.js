const prisma = require('../utils/prisma');

const createPlan = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    
    // Safety check if database was not pushed
    if (!prisma.plan) {
      return res.status(500).json({ success: false, message: 'Database schema is out of sync. Please stop the server, run `npx prisma db push` and `npx prisma generate`, then restart.' });
    }

    const { name, price, description, features } = req.body;
    const plan = await prisma.plan.create({
      data: { name, price: parseFloat(price), description, features: JSON.stringify(features || []) }
    });
    res.json({ success: true, data: plan });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPlans = async (req, res) => {
  try {
    // Safety check if database was not pushed
    if (!prisma.plan) {
      return res.json({ success: true, data: [] });
    }

    const plans = await prisma.plan.findMany();
    // parse features back to array if stored as JSON string
    const mappedPlans = plans.map(p => ({ ...p, features: p.features ? JSON.parse(p.features) : [] }));
    res.json({ success: true, data: mappedPlans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deletePlan = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    
    if (!prisma.plan) {
      return res.status(500).json({ success: false, message: 'Database schema is out of sync.' });
    }

    const { id } = req.params;
    await prisma.plan.delete({ where: { id } });
    res.json({ success: true, message: 'Plan deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createPlan, getPlans, deletePlan };
