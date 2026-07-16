const express = require('express');
const { body } = require('express-validator');
const { supabase } = require('../config/supabase');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { createServerInviteNotification } = require('../utils/notificationHelper');

const router = express.Router();

// @route   GET /api/servers/search
// @desc    Search public servers by name
router.get('/search', protect, async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    if (!q || q.trim().length === 0) {
      return res.json({ success: true, data: { servers: [] } });
    }

    const term = q.trim().toLowerCase();

    const { data: servers, error } = await supabase
      .from('servers')
      .select('*')
      .eq('is_public', true)
      .ilike('name', `%${term}%`)
      .limit(parseInt(limit));

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Attach owner info
    const ownerIds = [...new Set((servers || []).map(s => s.owner_id))];
    const { data: owners } = ownerIds.length
      ? await supabase.from('users').select('id, username, avatar').in('id', ownerIds)
      : { data: [] };

    const ownerMap = {};
    (owners || []).forEach(o => { ownerMap[o.id] = o; });

    const enriched = (servers || []).map(s => ({
      ...s,
      owner: ownerMap[s.owner_id] || null
    }));

    res.json({ success: true, data: { servers: enriched } });
  } catch (error) {
    console.error('Error searching servers:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/servers
router.get('/', protect, async (req, res) => {
  try {
    // Get servers where user is a member
    const { data: memberships } = await supabase
      .from('server_members')
      .select('server_id')
      .eq('user_id', req.user.id);

    const memberServerIds = (memberships || []).map(m => m.server_id);

    // Get user's servers + public servers (only lightweight fields needed for list)
    let query = supabase
      .from('servers')
      .select('id, name, description, anime_theme, tags, is_public, owner_id, member_count, icon, created_at');
    
    if (memberServerIds.length > 0) {
      query = query.or(`id.in.(${memberServerIds.join(',')}),is_public.eq.true`);
    } else {
      query = query.eq('is_public', true);
    }

    const { data: servers, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Attach owner info
    const ownerIds = [...new Set(servers.map(s => s.owner_id))];
    const { data: owners } = await supabase
      .from('users')
      .select('id, username, avatar')
      .in('id', ownerIds);

    const ownerMap = {};
    (owners || []).forEach(o => { ownerMap[o.id] = o; });

    const memberServerIdSet = new Set(memberServerIds);
    const enriched = servers.map(s => ({
      ...s,
      owner: ownerMap[s.owner_id] || null,
      is_member: memberServerIdSet.has(s.id)
    }));

    res.json({ success: true, data: { servers: enriched } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/servers
router.post('/', protect, [
  body('name').trim().notEmpty().withMessage('Server name is required'),
  body('description').optional().trim(),
  body('animeTheme').optional().trim(),
  body('tags').optional().isArray(),
  body('isPublic').optional().isBoolean(),
  validate
], async (req, res) => {
  try {
    const { name, description, animeTheme, tags, isPublic, memberIds, icon } = req.body;

    // Calculate initial member count (owner + invited members)
    const invitedMembers = Array.isArray(memberIds) ? memberIds.filter(id => id !== req.user.id) : [];
    const initialMemberCount = 1 + invitedMembers.length;

    // Create server
    const serverInsert = {
      name,
      description: description || '',
      anime_theme: animeTheme || null,
      tags: tags || [],
      is_public: isPublic !== undefined ? isPublic : true,
      owner_id: req.user.id,
      member_count: initialMemberCount
    };
    if (icon) serverInsert.icon = icon;

    const { data: server, error } = await supabase
      .from('servers')
      .insert(serverInsert)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    // Add owner as member
    await supabase.from('server_members').insert({
      server_id: server.id,
      user_id: req.user.id,
      role: 'owner'
    });

    // Add invited friends as members
    if (invitedMembers.length > 0) {
      const memberRows = invitedMembers.map(uid => ({
        server_id: server.id,
        user_id: uid,
        role: 'member'
      }));
      const { error: memberInsertError } = await supabase.from('server_members').insert(memberRows);
      if (memberInsertError) {
        console.error('Error inserting invited members:', memberInsertError);
      }

      // Add server to each invited member's servers array + send notifications
      const io = req.app.get('io');
      for (const uid of invitedMembers) {
        try {
          const { data: memberUser } = await supabase
            .from('users')
            .select('servers')
            .eq('id', uid)
            .single();
          const memberServers = memberUser?.servers || [];
          if (!memberServers.includes(server.id)) {
            await supabase
              .from('users')
              .update({ servers: [...memberServers, server.id] })
              .eq('id', uid);
          }

          // Send notification using helper
          await createServerInviteNotification(uid, req.user, server);

          // Emit real-time notification
          if (io) {
            io.to(`user:${uid}`).emit('server:added', {
              serverId: server.id,
              serverName: server.name,
              serverIcon: server.icon,
              addedBy: req.user.username,
              addedByAvatar: req.user.avatar
            });
          }
        } catch (userUpdateErr) {
          console.error(`Error updating servers array for user ${uid}:`, userUpdateErr);
        }
      }
    }

    // Create default channel
    await supabase.from('channels').insert({
      name: 'general',
      server_id: server.id,
      type: 'text',
      position: 0
    });

    // Add server to user's servers array
    const currentServers = req.user.servers || [];
    await supabase
      .from('users')
      .update({ servers: [...currentServers, server.id] })
      .eq('id', req.user.id);

    res.status(201).json({
      success: true,
      data: { server: { ...server, owner: { id: req.user.id, username: req.user.username, avatar: req.user.avatar } } }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/servers/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const { data: server, error } = await supabase
      .from('servers')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !server) {
      return res.status(404).json({ success: false, message: 'Server not found' });
    }

    // Get members with user info
    const { data: members } = await supabase
      .from('server_members')
      .select('user_id, role, joined_at')
      .eq('server_id', server.id);

    const memberUserIds = (members || []).map(m => m.user_id);
    const { data: memberUsers } = await supabase
      .from('users')
      .select('id, username, avatar, is_online')
      .in('id', memberUserIds.length ? memberUserIds : ['00000000-0000-0000-0000-000000000000']);

    const userMap = {};
    (memberUsers || []).forEach(u => { userMap[u.id] = u; });

    const enrichedMembers = (members || []).map(m => ({
      user: userMap[m.user_id] || null,
      role: m.role,
      joinedAt: m.joined_at
    }));

    // Check access
    const isMember = memberUserIds.includes(req.user.id);
    if (!server.is_public && !isMember) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get owner
    const { data: owner } = await supabase
      .from('users')
      .select('id, username, avatar')
      .eq('id', server.owner_id)
      .single();

    res.json({
      success: true,
      data: { server: { ...server, owner, members: enrichedMembers } }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/servers/:id/join
router.post('/:id/join', protect, async (req, res) => {
  try {
    const { data: server, error } = await supabase
      .from('servers')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !server) {
      return res.status(404).json({ success: false, message: 'Server not found' });
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('server_members')
      .select('id')
      .eq('server_id', server.id)
      .eq('user_id', req.user.id)
      .single();

    if (existing) {
      return res.status(400).json({ success: false, message: 'Already a member' });
    }

    if (server.member_count >= server.max_members) {
      return res.status(400).json({ success: false, message: 'Server is full' });
    }

    // For public servers -> create a join request (admin must approve)
    // Check if a pending request already exists
    const { data: existingReq } = await supabase
      .from('join_requests')
      .select('id, status')
      .eq('server_id', server.id)
      .eq('user_id', req.user.id)
      .eq('status', 'pending')
      .single();

    if (existingReq) {
      return res.status(400).json({ success: false, message: 'Join request already pending' });
    }

    // Create join request
    const { data: joinReq, error: jrErr } = await supabase
      .from('join_requests')
      .insert({
        server_id: server.id,
        user_id: req.user.id,
        status: 'pending'
      })
      .select()
      .single();

    if (jrErr) {
      return res.status(500).json({ success: false, message: jrErr.message });
    }

    res.json({ success: true, data: { joinRequest: joinReq }, message: 'Join request sent! Waiting for admin approval.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/servers/:id/leave
router.post('/:id/leave', protect, async (req, res) => {
  try {
    const { data: server, error } = await supabase
      .from('servers')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !server) {
      return res.status(404).json({ success: false, message: 'Server not found' });
    }

    if (server.owner_id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Owner cannot leave. Transfer ownership or delete server.' });
    }

    // Remove membership
    await supabase
      .from('server_members')
      .delete()
      .eq('server_id', server.id)
      .eq('user_id', req.user.id);

    // Update count
    await supabase
      .from('servers')
      .update({ member_count: Math.max(0, server.member_count - 1) })
      .eq('id', server.id);

    // Remove from user's servers array
    const currentServers = (req.user.servers || []).filter(id => id !== server.id);
    await supabase
      .from('users')
      .update({ servers: currentServers })
      .eq('id', req.user.id);

    res.json({ success: true, message: 'Left server successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/servers/:id
// @desc    Update server info (admin/owner only)
router.put('/:id', protect, async (req, res) => {
  try {
    const { data: membership } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ success: false, message: 'Only admins can update server' });
    }

    const allowed = {};
    if (req.body.name) allowed.name = req.body.name;
    if (req.body.description !== undefined) allowed.description = req.body.description;
    if (req.body.isPublic !== undefined) allowed.is_public = req.body.isPublic;
    if (req.body.tags) allowed.tags = req.body.tags;
    if (req.body.animeTheme !== undefined) allowed.anime_theme = req.body.animeTheme;

    const { data: server, error } = await supabase
      .from('servers')
      .update(allowed)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, message: error.message });

    res.json({ success: true, data: { server } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/servers/:id/settings
// @desc    Update server permission settings (admin/owner only)
router.put('/:id/settings', protect, async (req, res) => {
  try {
    const { data: membership } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ success: false, message: 'Only admins can change settings' });
    }

    const settings = {};
    if (req.body.allow_member_chat !== undefined) settings.allow_member_chat = req.body.allow_member_chat;
    if (req.body.allow_member_post !== undefined) settings.allow_member_post = req.body.allow_member_post;
    if (req.body.allow_member_invite !== undefined) settings.allow_member_invite = req.body.allow_member_invite;

    const { data: server, error } = await supabase
      .from('servers')
      .update({ settings })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ success: false, message: error.message });

    res.json({ success: true, data: { server } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/servers/:id/members/:userId/role
// @desc    Change a member's role (admin/owner only)
router.put('/:id/members/:userId/role', protect, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'moderator', 'member'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    // Check requester's role
    const { data: requesterMembership } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
      return res.status(403).json({ success: false, message: 'Only admins can change roles' });
    }

    // Cannot change the owner's role
    const { data: server } = await supabase
      .from('servers')
      .select('owner_id')
      .eq('id', req.params.id)
      .single();

    if (req.params.userId === server.owner_id) {
      return res.status(400).json({ success: false, message: 'Cannot change the owner\'s role' });
    }

    // Only owner can promote someone to admin
    if (role === 'admin' && requesterMembership.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Only the owner can promote to admin' });
    }

    const { error } = await supabase
      .from('server_members')
      .update({ role })
      .eq('server_id', req.params.id)
      .eq('user_id', req.params.userId);

    if (error) return res.status(500).json({ success: false, message: error.message });

    res.json({ success: true, message: `Role updated to ${role}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/servers/:id/members/:userId
// @desc    Kick a member (admin/owner only)
router.delete('/:id/members/:userId', protect, async (req, res) => {
  try {
    const { data: requesterMembership } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
      return res.status(403).json({ success: false, message: 'Only admins can kick members' });
    }

    const { data: server } = await supabase
      .from('servers')
      .select('owner_id, member_count')
      .eq('id', req.params.id)
      .single();

    // Permission checks based on roles:
    // 1. Cannot kick yourself
    if (req.params.userId === req.user.id) {
      return res.status(403).json({ success: false, message: 'You cannot remove yourself' });
    }

    // 2. Admin cannot kick owner
    if (req.params.userId === server.owner_id && requesterMembership.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admins cannot remove the owner' });
    }

    // 3. Admin cannot kick other admins
    const { data: targetMembership } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', req.params.id)
      .eq('user_id', req.params.userId)
      .single();

    if (targetMembership?.role === 'admin' && requesterMembership.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Admins cannot remove other admins' });
    }

    // 4. Owner can kick anyone (admins, members)
    // 5. Admin can kick members only

    await supabase
      .from('server_members')
      .delete()
      .eq('server_id', req.params.id)
      .eq('user_id', req.params.userId);

    await supabase
      .from('servers')
      .update({ member_count: Math.max(0, (server.member_count || 1) - 1) })
      .eq('id', req.params.id);

    // Remove server from the kicked user's servers array
    const { data: kickedUser } = await supabase
      .from('users')
      .select('servers')
      .eq('id', req.params.userId)
      .single();

    if (kickedUser) {
      const updatedServers = (kickedUser.servers || []).filter(id => id !== req.params.id);
      await supabase.from('users').update({ servers: updatedServers }).eq('id', req.params.userId);
    }

    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/servers/:id
// @desc    Delete server (owner only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const { data: server } = await supabase
      .from('servers')
      .select('owner_id')
      .eq('id', req.params.id)
      .single();

    if (!server) return res.status(404).json({ success: false, message: 'Server not found' });
    if (server.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the owner can delete the server' });
    }

    // Delete channels, messages, members, then server
    const { data: channels } = await supabase
      .from('channels')
      .select('id')
      .eq('server_id', req.params.id);

    const channelIds = (channels || []).map(c => c.id);
    if (channelIds.length > 0) {
      await supabase.from('messages').delete().in('channel_id', channelIds);
      await supabase.from('channels').delete().eq('server_id', req.params.id);
    }

    await supabase.from('server_members').delete().eq('server_id', req.params.id);
    await supabase.from('join_requests').delete().eq('server_id', req.params.id);
    await supabase.from('servers').delete().eq('id', req.params.id);

    res.json({ success: true, message: 'Server deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/servers/:id/join-requests
// @desc    Get pending join requests for a server (admin/owner only)
router.get('/:id/join-requests', protect, async (req, res) => {
  try {
    const { data: membership } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ success: false, message: 'Only admins can view join requests' });
    }

    const { data: requests, error } = await supabase
      .from('join_requests')
      .select('*')
      .eq('server_id', req.params.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ success: false, message: error.message });

    // Enrich with user info
    const userIds = (requests || []).map(r => r.user_id);
    const { data: users } = userIds.length
      ? await supabase.from('users').select('id, username, avatar, display_name, is_online').in('id', userIds)
      : { data: [] };

    const userMap = {};
    (users || []).forEach(u => { userMap[u.id] = u; });

    const enriched = (requests || []).map(r => ({
      ...r,
      user: userMap[r.user_id] || null
    }));

    res.json({ success: true, data: { requests: enriched } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/servers/:id/join-requests/:requestId/approve
// @desc    Approve a join request (admin/owner only)
router.post('/:id/join-requests/:requestId/approve', protect, async (req, res) => {
  try {
    const { data: membership } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ success: false, message: 'Only admins can approve requests' });
    }

    const { data: joinReq, error: jrErr } = await supabase
      .from('join_requests')
      .select('*')
      .eq('id', req.params.requestId)
      .eq('server_id', req.params.id)
      .eq('status', 'pending')
      .single();

    if (jrErr || !joinReq) {
      return res.status(404).json({ success: false, message: 'Join request not found or already processed' });
    }

    // Update request status
    await supabase
      .from('join_requests')
      .update({ status: 'approved' })
      .eq('id', joinReq.id);

    // Add user as member
    await supabase.from('server_members').insert({
      server_id: req.params.id,
      user_id: joinReq.user_id,
      role: 'member'
    });

    // Update member count
    const { data: server } = await supabase
      .from('servers')
      .select('member_count')
      .eq('id', req.params.id)
      .single();

    await supabase
      .from('servers')
      .update({ member_count: (server?.member_count || 0) + 1 })
      .eq('id', req.params.id);

    // Add server to user's servers array
    const { data: joinUser } = await supabase
      .from('users')
      .select('servers')
      .eq('id', joinReq.user_id)
      .single();

    const userServers = joinUser?.servers || [];
    await supabase
      .from('users')
      .update({ servers: [...userServers, req.params.id] })
      .eq('id', joinReq.user_id);

    // Fetch server name for notification
    const { data: approvedServer } = await supabase
      .from('servers')
      .select('name, icon')
      .eq('id', req.params.id)
      .single();

    // Insert notification
    await supabase.from('notifications').insert({
      user_id: joinReq.user_id,
      type: 'server_approved',
      title: 'Join Request Approved',
      body: `Your request to join "${approvedServer?.name || 'a server'}" was approved`,
      data: { server_id: req.params.id, server_name: approvedServer?.name || '' }
    });

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${joinReq.user_id}`).emit('server:added', {
        serverId: req.params.id,
        serverName: approvedServer?.name || '',
        serverIcon: approvedServer?.icon || '',
        addedBy: req.user.username,
        addedByAvatar: req.user.avatar
      });
    }

    res.json({ success: true, message: 'Join request approved' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/servers/:id/join-requests/:requestId/reject
// @desc    Reject a join request (admin/owner only)
router.post('/:id/join-requests/:requestId/reject', protect, async (req, res) => {
  try {
    const { data: membership } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ success: false, message: 'Only admins can reject requests' });
    }

    const { error } = await supabase
      .from('join_requests')
      .update({ status: 'rejected' })
      .eq('id', req.params.requestId)
      .eq('server_id', req.params.id)
      .eq('status', 'pending');

    if (error) return res.status(500).json({ success: false, message: error.message });

    res.json({ success: true, message: 'Join request rejected' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/servers/:id/my-join-status
// @desc    Get the current user's join request status for a server
router.get('/:id/my-join-status', protect, async (req, res) => {
  try {
    const { data: joinReq } = await supabase
      .from('join_requests')
      .select('id, status, created_at')
      .eq('server_id', req.params.id)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    res.json({ success: true, data: { joinRequest: joinReq || null } });
  } catch (error) {
    res.json({ success: true, data: { joinRequest: null } });
  }
});

// @route   POST /api/servers/:id/add-member
// @desc    Admin manually adds a user to the server (user must be a friend/follower of admin)
router.post('/:id/add-member', protect, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    // Check admin role
    const { data: membership } = await supabase
      .from('server_members')
      .select('role')
      .eq('server_id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return res.status(403).json({ success: false, message: 'Only admins can add members' });
    }

    // Check the target user is a friend of the admin
    const adminFriends = req.user.friends || [];
    if (!adminFriends.includes(userId)) {
      return res.status(400).json({ success: false, message: 'You can only add users who are your friends' });
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('server_members')
      .select('id')
      .eq('server_id', req.params.id)
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      return res.status(400).json({ success: false, message: 'User is already a member' });
    }

    // Add as member
    await supabase.from('server_members').insert({
      server_id: req.params.id,
      user_id: userId,
      role: 'member'
    });

    // Update member count
    const { data: server } = await supabase
      .from('servers')
      .select('member_count')
      .eq('id', req.params.id)
      .single();

    await supabase
      .from('servers')
      .update({ member_count: (server?.member_count || 0) + 1 })
      .eq('id', req.params.id);

    // Add server to user's servers array
    const { data: addedUser } = await supabase
      .from('users')
      .select('servers')
      .eq('id', userId)
      .single();

    const userServers = addedUser?.servers || [];
    await supabase
      .from('users')
      .update({ servers: [...userServers, req.params.id] })
      .eq('id', userId);

    // Clear any pending join request if exists
    await supabase
      .from('join_requests')
      .update({ status: 'approved' })
      .eq('server_id', req.params.id)
      .eq('user_id', userId)
      .eq('status', 'pending');

    // Fetch server info for notification
    const { data: addedServer } = await supabase
      .from('servers')
      .select('name, icon')
      .eq('id', req.params.id)
      .single();

    // Insert notification
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'server_added',
      title: 'Added to Server',
      body: `${req.user.username} added you to "${addedServer?.name || 'a server'}"`,
      data: { server_id: req.params.id, server_name: addedServer?.name || '', added_by: req.user.id, added_by_username: req.user.username }
    });

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('server:added', {
        serverId: req.params.id,
        serverName: addedServer?.name || '',
        serverIcon: addedServer?.icon || '',
        addedBy: req.user.username,
        addedByAvatar: req.user.avatar
      });
    }

    res.json({ success: true, message: 'Member added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
