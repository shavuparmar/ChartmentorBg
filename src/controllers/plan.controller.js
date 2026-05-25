const prisma = require('../utils/prisma');

const createPlan = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    
    // Safety check if database was not pushed
    if (!prisma.plan) {
      return res.status(500).json({ success: false, message: 'Database schema is out of sync. Please stop the server, run `npx prisma db push` and `npx prisma generate`, then restart.' });
    }

    const { name, price, description, features, discountPrice, durationDays, startDate, endDate, isActive, isVisible, membershipType } = req.body;
    
    if (startDate) {
      const start = new Date(startDate);
      const today = new Date();
      today.setHours(0,0,0,0);
      if (start < today) {
        return res.status(400).json({ success: false, message: 'Course start date cannot be in the past' });
      }
    }
    if (startDate && endDate) {
      if (new Date(endDate) < new Date(startDate)) {
        return res.status(400).json({ success: false, message: 'End date cannot be before start date' });
      }
    }

    const plan = await prisma.plan.create({
      data: { 
        name, 
        price: parseFloat(price), 
        discountPrice: discountPrice ? parseFloat(discountPrice) : null,
        durationDays: durationDays ? parseInt(durationDays) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive !== undefined ? isActive : true,
        isVisible: isVisible !== undefined ? isVisible : true,
        membershipType,
        description, 
        features: JSON.stringify(features || []) 
      }
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

    const plans = await prisma.plan.findMany({
      orderBy: { createdAt: 'desc' }
    });
    // parse features back to array if stored as JSON string
    const mappedPlans = plans.map(p => ({ ...p, features: p.features ? JSON.parse(p.features) : [] }));
    res.json({ success: true, data: mappedPlans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updatePlan = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    
    const { id } = req.params;
    const { name, price, description, features, discountPrice, durationDays, startDate, endDate, isActive, isVisible, membershipType } = req.body;
    
    const existingPlan = await prisma.plan.findUnique({ where: { id } });
    if (!existingPlan) return res.status(404).json({ success: false, message: 'Course not found' });
    
    const finalStartDate = startDate !== undefined ? (startDate ? new Date(startDate) : null) : existingPlan.startDate;
    const finalEndDate = endDate !== undefined ? (endDate ? new Date(endDate) : null) : existingPlan.endDate;
    
    if (startDate !== undefined && startDate) {
      const newStart = new Date(startDate);
      const existingStart = existingPlan.startDate ? new Date(existingPlan.startDate) : null;
      
      if (!existingStart || newStart.getTime() !== existingStart.getTime()) {
        const today = new Date();
        today.setHours(0,0,0,0);
        if (newStart < today) {
          return res.status(400).json({ success: false, message: 'Course start date cannot be in the past' });
        }
      }
    }

    if (finalStartDate && finalEndDate) {
      if (new Date(finalEndDate) < new Date(finalStartDate)) {
        return res.status(400).json({ success: false, message: 'End date cannot be before start date' });
      }
    }

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (price !== undefined) dataToUpdate.price = parseFloat(price);
    if (description !== undefined) dataToUpdate.description = description;
    if (features !== undefined) dataToUpdate.features = JSON.stringify(features);
    if (discountPrice !== undefined) dataToUpdate.discountPrice = discountPrice ? parseFloat(discountPrice) : null;
    if (durationDays !== undefined) dataToUpdate.durationDays = durationDays ? parseInt(durationDays) : null;
    if (startDate !== undefined) dataToUpdate.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) dataToUpdate.endDate = endDate ? new Date(endDate) : null;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;
    if (isVisible !== undefined) dataToUpdate.isVisible = isVisible;
    if (membershipType !== undefined) dataToUpdate.membershipType = membershipType;

    const plan = await prisma.plan.update({
      where: { id },
      data: dataToUpdate
    });
    res.json({ success: true, data: plan });
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

module.exports = { createPlan, getPlans, updatePlan, deletePlan };
