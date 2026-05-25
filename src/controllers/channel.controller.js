const prisma = require('../utils/prisma');

// Admin only
const createChannel = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const { name, type, link, description, planIds, isActive, isVisible } = req.body;
    
    const channel = await prisma.channel.create({
      data: { name, type, link, description, planIds: planIds || [], isActive, isVisible }
    });
    res.json({ success: true, data: channel });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin only
const getAllChannels = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const channels = await prisma.channel.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ success: true, data: channels });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin only
const updateChannel = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const { id } = req.params;
    const { name, type, link, description, planIds, isActive, isVisible } = req.body;

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (type !== undefined) dataToUpdate.type = type;
    if (link !== undefined) dataToUpdate.link = link;
    if (description !== undefined) dataToUpdate.description = description;
    if (planIds !== undefined) dataToUpdate.planIds = planIds;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;
    if (isVisible !== undefined) dataToUpdate.isVisible = isVisible;

    const channel = await prisma.channel.update({ where: { id }, data: dataToUpdate });
    res.json({ success: true, data: channel });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin only
const deleteChannel = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const { id } = req.params;
    await prisma.channel.delete({ where: { id } });
    res.json({ success: true, message: 'Channel deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// For Students
const getMyChannels = async (req, res) => {
  try {
    const membership = await prisma.membership.findUnique({ where: { userId: req.user.id } });
    
    if (!membership || membership.status !== 'ACTIVE') {
      return res.json({ success: true, data: [] });
    }

    // Fetch channels that are active, visible, and include the user's planId
    const channels = await prisma.channel.findMany({
      where: {
        isActive: true,
        isVisible: true
      }
    });

    // Manually filter by planId since Prisma Postgres Array filter uses has
    const allowedChannels = channels.filter(c => {
      if (!c.planIds || c.planIds.length === 0) return true; // If no plans assigned, maybe it's for everyone?
      // Wait, requirement: "Assign channels to specific plans". If assigned, restrict.
      if (!membership.planId) return false; // If student has no planId tracked, deny if channel has strict plans
      return c.planIds.includes(membership.planId);
    });

    res.json({ success: true, data: allowedChannels });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createChannel, getAllChannels, updateChannel, deleteChannel, getMyChannels };
