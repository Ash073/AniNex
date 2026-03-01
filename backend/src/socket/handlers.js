const { verifyToken } = require('../config/jwt');
const { supabase } = require('../config/supabase');
const { sendExpoPush } = require('../utils/expoPush');

const setupSocketHandlers = (io) => {
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error('Invalid token'));
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, avatar, servers')
        .eq('id', decoded.id)
        .single();

      if (error || !user) {
        return next(new Error('User not found'));
      }

      socket.userId = user.id;
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Update user online status
    await supabase
      .from('users')
      .update({ is_online: true, last_seen: new Date().toISOString() })
      .eq('id', socket.userId);

    // Join user's servers
    const userServers = socket.user.servers || [];
    userServers.forEach(serverId => {
      socket.join(`server:${serverId}`);
    });

    // Broadcast online status
    io.emit('user:status', {
      userId: socket.userId,
      isOnline: true
    });

    // Join user's personal room for DM notifications
    socket.join(`user:${socket.userId}`);

    // Join a DM conversation room
    socket.on('dm:join', async (conversationId) => {
      try {
        const { data: convo } = await supabase
          .from('conversations')
          .select('participant_1, participant_2')
          .eq('id', conversationId)
          .single();

        if (!convo) return;
        if (convo.participant_1 !== socket.userId && convo.participant_2 !== socket.userId) return;

        socket.join(`dm:${conversationId}`);
        socket.currentDM = conversationId;
      } catch (error) {
        console.error('DM join error:', error);
      }
    });

    socket.on('dm:leave', (conversationId) => {
      socket.leave(`dm:${conversationId}`);
      if (socket.currentDM === conversationId) {
        socket.currentDM = null;
      }
    });

    // Send DM via socket (alternative to REST)
    socket.on('dm:send', async (data) => {
      try {
        const { conversationId, content, image_url, repliedToId } = data;

        if (!content && !image_url) return;

        const { data: convo } = await supabase
          .from('conversations')
          .select('participant_1, participant_2')
          .eq('id', conversationId)
          .single();

        if (!convo) return;
        if (convo.participant_1 !== socket.userId && convo.participant_2 !== socket.userId) return;

        const insertData = {
          conversation_id: conversationId,
          sender_id: socket.userId,
          content: content || '',
        };
        if (image_url) insertData.image_url = image_url;
        if (repliedToId) insertData.replied_to_id = repliedToId;

        const { data: message, error } = await supabase
          .from('direct_messages')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          socket.emit('dm:error', { message: 'Failed to send DM' });
          return;
        }

        // Update conversation
        await supabase
          .from('conversations')
          .update({
            last_message_text: image_url ? '📷 Image' : (content || '').substring(0, 100),
            last_message_at: new Date().toISOString(),
          })
          .eq('id', conversationId);

        const populatedMessage = {
          ...message,
          sender: {
            id: socket.user.id,
            username: socket.user.username,
            avatar: socket.user.avatar,
            is_online: true,
          },
        };

        io.to(`dm:${conversationId}`).emit('dm:new', populatedMessage);

        const otherId = convo.participant_1 === socket.userId
          ? convo.participant_2
          : convo.participant_1;
        io.to(`user:${otherId}`).emit('dm:notification', {
          conversationId,
          message: populatedMessage,
        });

        // Send push notification to recipient
        try {
          const { data: otherUser } = await supabase
            .from('users')
            .select('push_token')
            .eq('id', otherId)
            .single();
          if (otherUser && otherUser.push_token) {
            const pushBody = image_url ? '📷 Sent an image' : (content || 'New message').substring(0, 100);
            sendExpoPush(otherUser.push_token, socket.user.username, pushBody, {
              type: 'dm',
              conversationId,
              senderName: socket.user.username,
              senderAvatar: socket.user.avatar,
            }).catch(err => console.error('DM push error:', err));
          }
        } catch (pushErr) {
          // Push is best-effort, don't fail the message
        }
      } catch (error) {
        console.error('DM send error:', error);
        socket.emit('dm:error', { message: 'Failed to send DM' });
      }
    });

    // DM typing
    socket.on('dm:typing:start', (conversationId) => {
      socket.to(`dm:${conversationId}`).emit('dm:typing:start', {
        userId: socket.userId,
        username: socket.user.username,
        conversationId,
      });
    });

    socket.on('dm:typing:stop', (conversationId) => {
      socket.to(`dm:${conversationId}`).emit('dm:typing:stop', {
        userId: socket.userId,
        conversationId,
      });
    });

    // Join a channel
    socket.on('channel:join', async (channelId) => {
      try {
        const { data: channel } = await supabase
          .from('channels')
          .select('id, server_id')
          .eq('id', channelId)
          .single();

        if (!channel) return;

        const { data: membership } = await supabase
          .from('server_members')
          .select('id')
          .eq('server_id', channel.server_id)
          .eq('user_id', socket.userId)
          .single();

        if (!membership) return;

        socket.join(`channel:${channelId}`);
        socket.currentChannel = channelId;
      } catch (error) {
        console.error('Channel join error:', error);
      }
    });

    // Leave a channel
    socket.on('channel:leave', (channelId) => {
      socket.leave(`channel:${channelId}`);
      if (socket.currentChannel === channelId) {
        socket.currentChannel = null;
      }
    });

    // Send message
    socket.on('message:send', async (data) => {
      try {
        const { content, channelId, image_url, repliedToId } = data;

        if (!content && !image_url) return;

        const { data: channel } = await supabase
          .from('channels')
          .select('id, server_id')
          .eq('id', channelId)
          .single();

        if (!channel) return;

        const { data: membership } = await supabase
          .from('server_members')
          .select('id, role')
          .eq('server_id', channel.server_id)
          .eq('user_id', socket.userId)
          .single();

        if (!membership) return;

        // Check server permission settings
        const { data: serverData } = await supabase
          .from('servers')
          .select('settings')
          .eq('id', channel.server_id)
          .single();

        const settings = serverData?.settings || {};
        const allowMemberChat = settings.allow_member_chat !== false; // default true
        if (!allowMemberChat && !['owner', 'admin'].includes(membership.role)) {
          socket.emit('message:error', { message: 'Only admins can chat in this server' });
          return;
        }

        // Parse mentions from content
        let processedContent = content;
        const mentions = [];

        // Extract @mentions from content
        const mentionRegex = /@(\w+)/g;
        let match;
        while ((match = mentionRegex.exec(content)) !== null) {
          const username = match[1];
          // Get user by username
          const { data: mentionedUser } = await supabase
            .from('users')
            .select('id, username')
            .eq('username', username)
            .single();

          if (mentionedUser && mentionedUser.id !== socket.userId) {
            mentions.push({
              user_id: mentionedUser.id,
              username: mentionedUser.username
            });
            // Replace @username with formatted mention for frontend
            processedContent = processedContent.replace(`@${username}`, `[@${username}](user:${mentionedUser.id})`);
          }
        }

        const attachments = image_url ? [{ url: image_url, type: 'image' }] : [];

        const insertData = {
          content: processedContent,
          author_id: socket.userId,
          channel_id: channelId,
          server_id: channel.server_id,
          attachments,
        };
        if (repliedToId) insertData.replied_to_id = repliedToId;

        const { data: message, error } = await supabase
          .from('messages')
          .insert(insertData)
          .select()
          .single();

        if (error) {
          socket.emit('message:error', { message: 'Failed to send message' });
          return;
        }

        const populatedMessage = {
          ...message,
          author: {
            id: socket.user.id,
            username: socket.user.username,
            avatar: socket.user.avatar,
            is_online: true
          },
          mentions: mentions
        };

        // Broadcast to channel
        io.to(`channel:${channelId}`).emit('message:new', populatedMessage);

        // Send push notifications to other server members
        try {
          const { data: members } = await supabase
            .from('server_members')
            .select('user_id')
            .eq('server_id', channel.server_id)
            .neq('user_id', socket.userId);

          if (members && members.length > 0) {
            const memberIds = members.map(m => m.user_id);
            const { data: users } = await supabase
              .from('users')
              .select('id, push_token')
              .in('id', memberIds)
              .not('push_token', 'is', null);

            if (users) {
              const pushBody = image_url ? '📷 Image' : (content || 'New message').substring(0, 100);
              for (const u of users) {
                if (u.push_token) {
                  sendExpoPush(u.push_token, `${socket.user.username} in server`, pushBody, {
                    type: 'server_message',
                    channelId,
                    serverId: channel.server_id,
                  }).catch(() => { });
                }
              }
            }
          }
        } catch (pushErr) {
          // Push is best-effort
        }
      } catch (error) {
        console.error('Message send error:', error);
        socket.emit('message:error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing:start', (channelId) => {
      socket.to(`channel:${channelId}`).emit('typing:start', {
        userId: socket.userId,
        username: socket.user.username,
        channelId
      });
    });

    socket.on('typing:stop', (channelId) => {
      socket.to(`channel:${channelId}`).emit('typing:stop', {
        userId: socket.userId,
        channelId
      });
    });

    // Mark message as read
    socket.on('message:read', async (data) => {
      try {
        const { messageId } = data;

        // Get current read_by and add to it
        const { data: msg } = await supabase
          .from('messages')
          .select('read_by')
          .eq('id', messageId)
          .single();

        if (msg) {
          const readBy = msg.read_by || [];
          const alreadyRead = readBy.some(r => r.user === socket.userId);
          if (!alreadyRead) {
            readBy.push({ user: socket.userId, readAt: new Date().toISOString() });
            await supabase
              .from('messages')
              .update({ read_by: readBy })
              .eq('id', messageId);
          }
        }
      } catch (error) {
        console.error('Message read error:', error);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.userId}`);

      await supabase
        .from('users')
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq('id', socket.userId);

      io.emit('user:status', {
        userId: socket.userId,
        isOnline: false
      });
    });
  });
};

module.exports = { setupSocketHandlers };
