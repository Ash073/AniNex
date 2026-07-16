const express = require('express');
const { supabase } = require('../config/supabase');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/blocks
// @desc    Block a user
router.post('/', protect, async (req, res) => {
  try {
    const { userId } = req.body;
    const blockerId = req.user.id;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // Check if user is trying to block themselves
    if (userId === blockerId) {
      return res.status(400).json({ success: false, message: 'You cannot block yourself' });
    }

    // Check if user exists
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if already blocked
    const { data: existingBlock, error: blockError } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', blockerId)
      .eq('blocked_id', userId)
      .single();

    if (existingBlock) {
      return res.status(400).json({ success: false, message: 'User is already blocked' });
    }

    // Create the block
    const { data: block, error } = await supabase
      .from('blocks')
      .insert({
        blocker_id: blockerId,
        blocked_id: userId
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.json({ success: true, message: 'User blocked successfully', data: { block } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/blocks/:userId
// @desc    Unblock a user
router.delete('/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const blockerId = req.user.id;

    // Check if user exists
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Remove the block
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', userId);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.json({ success: true, message: 'User unblocked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/blocks
// @desc    Get blocked users
router.get('/', protect, async (req, res) => {
  try {
    const blockerId = req.user.id;

    const { data: blocks, error } = await supabase
      .from('blocks')
      .select(`
        id,
        created_at,
        blocked_user: blocked_id (id, username, display_name, avatar)
      `)
      .eq('blocker_id', blockerId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.json({ success: true, data: { blocks: blocks || [] } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/blocks/check/:userId
// @desc    Check if a user is blocked
router.get('/check/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const blockerId = req.user.id;

    const { data: block, error } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', blockerId)
      .eq('blocked_id', userId)
      .single();

    res.json({ 
      success: true, 
      data: { 
        isBlocked: !!block,
        blockId: block?.id || null
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;