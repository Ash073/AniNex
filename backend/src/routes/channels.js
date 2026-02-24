const express = require('express');
const { body } = require('express-validator');
const { supabase } = require('../config/supabase');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/channels/server/:serverId
router.get('/server/:serverId', protect, async (req, res) => {
  try {
    // Check if user is a member
    const { data: membership } = await supabase
      .from('server_members')
      .select('id')
      .eq('server_id', req.params.serverId)
      .eq('user_id', req.user.id)
      .single();

    if (!membership) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { data: channels, error } = await supabase
      .from('channels')
      .select('*')
      .eq('server_id', req.params.serverId)
      .order('position');

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.json({ success: true, data: { channels } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/channels
router.post('/', protect, [
  body('name').trim().notEmpty().withMessage('Channel name is required'),
  body('serverId').notEmpty().withMessage('Server ID is required'),
  body('type').optional().isIn(['text', 'voice', 'announcement']),
  validate
], async (req, res) => {
  try {
    const { name, serverId, description, type } = req.body;

    // Check if user is owner or admin
    const { data: membership } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', serverId)
      .eq('user_id', req.user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ success: false, message: 'Only server owner or admin can create channels' });
    }

    // Count existing channels for position
    const { count } = await supabase
      .from('channels')
      .select('id', { count: 'exact', head: true })
      .eq('server_id', serverId);

    const { data: channel, error } = await supabase
      .from('channels')
      .insert({
        name,
        server_id: serverId,
        description: description || '',
        type: type || 'text',
        position: count || 0
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.status(201).json({ success: true, data: { channel } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
