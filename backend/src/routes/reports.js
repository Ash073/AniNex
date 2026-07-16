const express = require('express');
const { body } = require('express-validator');
const { supabase } = require('../config/supabase');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/reports
// @desc    Create a new report (user or post)
router.post('/', protect, [
  body('reportType').isIn(['spam', 'harassment', 'inappropriate_content', 'impersonation', 'violence', 'hate_speech', 'other']).withMessage('Invalid report type'),
  body('reason').trim().notEmpty().withMessage('Reason is required'),
  body('targetType').isIn(['user', 'post']).withMessage('Target type must be user or post'),
  body('targetId').trim().notEmpty().withMessage('Target ID is required'),
  body('description').optional().trim(),
  validate
], async (req, res) => {
  try {
    const { reportType, reason, targetType, targetId, description } = req.body;
    const reporterId = req.user.id;

    // Validate that user/post exists
    let targetExists = false;
    if (targetType === 'user') {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('id', targetId)
        .single();
      
      if (user && !userError) {
        targetExists = true;
      }
    } else if (targetType === 'post') {
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select('id')
        .eq('id', targetId)
        .single();
      
      if (post && !postError) {
        targetExists = true;
      }
    }

    if (!targetExists) {
      return res.status(404).json({ success: false, message: `${targetType} not found` });
    }

    // Check if user is reporting themselves
    if (targetType === 'user' && targetId === reporterId) {
      return res.status(400).json({ success: false, message: 'You cannot report yourself' });
    }

    // Check for duplicate reports (same reporter, same target, pending status)
    const { data: existingReports } = await supabase
      .from('reports')
      .select('id')
      .eq('reporter_id', reporterId)
      .eq(targetType === 'user' ? 'reported_user_id' : 'reported_post_id', targetId)
      .eq('status', 'pending');

    if (existingReports && existingReports.length > 0) {
      return res.status(400).json({ success: false, message: 'You have already reported this item and it is pending review' });
    }

    // Create the report
    const reportData = {
      reporter_id: reporterId,
      report_type: reportType,
      reason: reason,
      description: description || null,
      status: 'pending'
    };

    if (targetType === 'user') {
      reportData.reported_user_id = targetId;
    } else {
      reportData.reported_post_id = targetId;
    }

    const { data: report, error } = await supabase
      .from('reports')
      .insert(reportData)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.status(201).json({ 
      success: true, 
      message: 'Report submitted successfully',
      data: { reportId: report.id }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/reports
// @desc    Get reports (admin only)
router.get('/', protect, async (req, res) => {
  try {
    // Check if user is admin/owner of any server or has special permissions
    // For now, we'll implement basic admin check
    const { data: userServers } = await supabase
      .from('server_members')
      .select('role')
      .eq('user_id', req.user.id)
      .in('role', ['owner', 'admin']);

    if (!userServers || userServers.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { status, type, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('reports')
      .select(`
        id,
        report_type,
        reason,
        description,
        status,
        created_at,
        reporter:reporter_id (id, username, display_name, avatar),
        reported_user:reported_user_id (id, username, display_name, avatar),
        reported_post:reported_post_id (id, content, title, author_id)
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (type) {
      query = query.eq('report_type', type);
    }

    // Apply pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: reports, error, count } = await query;

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.json({
      success: true,
      data: {
        reports: reports || [],
        pagination: {
          total: count || 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/reports/:id/status
// @desc    Update report status (admin only)
router.put('/:id/status', protect, [
  body('status').isIn(['pending', 'reviewed', 'resolved', 'dismissed']).withMessage('Invalid status'),
  body('notes').optional().trim(),
  validate
], async (req, res) => {
  try {
    // Check admin permissions
    const { data: userServers } = await supabase
      .from('server_members')
      .select('role')
      .eq('user_id', req.user.id)
      .in('role', ['owner', 'admin']);

    if (!userServers || userServers.length === 0) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { status, notes } = req.body;

    const { data: report, error } = await supabase
      .from('reports')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.json({ 
      success: true, 
      message: 'Report status updated successfully',
      data: { report }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/reports/my-reports
// @desc    Get reports submitted by current user
router.get('/my-reports', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { data: reports, error, count } = await supabase
      .from('reports')
      .select(`
        id,
        report_type,
        reason,
        description,
        status,
        created_at,
        reported_user:reported_user_id (id, username, display_name, avatar),
        reported_post:reported_post_id (id, content, title)
      `)
      .eq('reporter_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    res.json({
      success: true,
      data: {
        reports: reports || [],
        pagination: {
          total: count || 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil((count || 0) / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;