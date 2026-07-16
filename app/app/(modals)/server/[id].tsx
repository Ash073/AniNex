import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  StyleSheet,
  TextInput,
  RefreshControl,
  Switch,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { serverService } from '@/services/serverService';
import { friendService } from '@/services/friendService';
import { dmService } from '@/services/dmService';
import { useAuthStore } from '@/store/authStore';
import { Channel, ServerSettings } from '@/types';
import { safeGoBack } from '@/utils/navigation';

/* ── Avatar helpers ── */
const LOCAL_AVATARS: Record<string, any> = {
  '1': require('@/assets/avatar/Avatar1.png.jpeg'),
  '2': require('@/assets/avatar/Avatar2.png.jpeg'),
  '3': require('@/assets/avatar/Avatar3.png.jpeg'),
  '4': require('@/assets/avatar/Avatar4.png.jpeg'),
  '5': require('@/assets/avatar/Avatar5.png.jpeg'),
  '6': require('@/assets/avatar/Avatar6.png.jpeg'),
  '7': require('@/assets/avatar/Avatar7.png.jpeg'),
  '8': require('@/assets/avatar/Avatar8.png.jpeg'),
  'r1': require('@/assets/avatar/Avatarr1.png'),
  'r2': require('@/assets/avatar/Avatarr2.png'),
  'r3': require('@/assets/avatar/Avatarr3.png'),
  'r4': require('@/assets/avatar/Avatarr4.png'),
  'r5': require('@/assets/avatar/Avatarr5.png'),
  'r6': require('@/assets/avatar/Avatarr6.png'),
  'r7': require('@/assets/avatar/Avatarr7.png'),
  'r8': require('@/assets/avatar/Avatarr8.png'),
  'r9': require('@/assets/avatar/Avatarr9.png'),
  'r10': require('@/assets/avatar/Avatarr10.png'),
};

function getAvatarSource(avatar?: string) {
  if (!avatar) return null;
  if (avatar.startsWith('local:')) return LOCAL_AVATARS[avatar.replace('local:', '')] ?? null;
  if (avatar.startsWith('gallery:')) {
    const uri = avatar.replace('gallery:', '');
    if (uri.startsWith('file') || uri.startsWith('/')) return null;
    return { uri };
  }
  if (avatar.startsWith('http')) return { uri: avatar };
  if (LOCAL_AVATARS[avatar]) return LOCAL_AVATARS[avatar];
  return null;
}

type Tab = 'channels' | 'members' | 'settings' | 'requests';

export default function ServerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>('channels');
  const [refreshing, setRefreshing] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [memberActionModal, setMemberActionModal] = useState<any>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Settings state
  const [allowChat, setAllowChat] = useState(true);
  const [allowPost, setAllowPost] = useState(true);
  const [allowInvite, setAllowInvite] = useState(true);

  const {
    data: server,
    isLoading: serverLoading,
    refetch: refetchServer,
  } = useQuery({
    queryKey: ['server', id],
    queryFn: () => serverService.getServer(id),
    enabled: !!id,
  });

  const {
    data: channels = [],
    isLoading: channelsLoading,
    refetch: refetchChannels,
  } = useQuery({
    queryKey: ['channels', id],
    queryFn: () => serverService.getChannels(id),
    enabled: !!id,
  });

  // Join request status for non-members
  const {
    data: joinStatus,
    refetch: refetchJoinStatus,
  } = useQuery({
    queryKey: ['my-join-status', id],
    queryFn: () => serverService.getMyJoinStatus(id),
    enabled: !!id,
  });

  // Join requests list for admins
  const {
    data: joinRequests = [],
    refetch: refetchJoinRequests,
  } = useQuery({
    queryKey: ['join-requests', id],
    queryFn: () => serverService.getJoinRequests(id),
    enabled: !!id,
  });

  // Friends list for admin add-member
  const {
    data: friendsList = [],
  } = useQuery({
    queryKey: ['friends-list'],
    queryFn: () => friendService.getFriends(),
    enabled: !!id,
  });

  // Sync settings from server
  useEffect(() => {
    if (server?.settings) {
      setAllowChat(server.settings.allow_member_chat !== false);
      setAllowPost(server.settings.allow_member_post !== false);
      setAllowInvite(server.settings.allow_member_invite !== false);
    }
  }, [server]);

  const userId = user?._id || user?.id;
  const myMembership = server?.members?.find(
    (m: any) => (typeof m.user === 'string' ? m.user : m.user?.id || m.user?._id) === userId
  );
  const isMember = !!myMembership;
  const isOwner =
    (typeof server?.owner === 'string'
      ? server?.owner
      : server?.owner?.id || (server?.owner as any)?._id) === userId || server?.owner_id === userId;
  const isAdmin = isOwner || myMembership?.role === 'admin';

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchServer(), refetchChannels(), refetchJoinStatus(), refetchJoinRequests()]);
    setRefreshing(false);
  }, [refetchServer, refetchChannels, refetchJoinStatus, refetchJoinRequests]);

  const handleJoinLeave = async () => {
    if (!server) return;
    const sid = server._id || server.id;
    try {
      if (isMember) {
        if (isOwner) {
          Alert.alert('Cannot Leave', 'Transfer ownership or delete the server first.');
          return;
        }
        await serverService.leaveServer(sid);
        Alert.alert('Left', 'You left the server.');
        safeGoBack('/(modals)/messages');
      } else {
        // Check if already pending
        if (joinStatus?.status === 'pending') {
          Alert.alert('Pending', 'Your join request is already pending admin approval.');
          return;
        }
        await serverService.joinServer(sid);
        Alert.alert(
          'Request Sent!',
          'Your request to join has been sent. The admin will review it shortly.',
          [{ text: 'OK' }]
        );
        refetchJoinStatus();
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed');
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    if (!server) return;
    const sid = server._id || server.id;
    try {
      await serverService.approveJoinRequest(sid, requestId);
      Alert.alert('Approved', 'Member has been added to the server.');
      refetchJoinRequests();
      refetchServer();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to approve');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (!server) return;
    const sid = server._id || server.id;
    Alert.alert('Reject Request', 'Are you sure you want to reject this request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await serverService.rejectJoinRequest(sid, requestId);
            refetchJoinRequests();
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to reject');
          }
        },
      },
    ]);
  };

  const handleAddMember = async (friendUserId: string) => {
    if (!server) return;
    const sid = server._id || server.id;
    try {
      await serverService.addMember(sid, friendUserId);
      Alert.alert('Added', 'Member has been added to the server.');
      setShowAddMemberModal(false);
      refetchServer();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to add member');
    }
  };

  const handleShareServer = async (friendUserId: string) => {
    if (!server) return;
    try {
      const conversation = await dmService.startConversation(friendUserId);
      const convId = conversation._id || conversation.id || (conversation as any).conversation?.id;
      const memberCount = server.member_count ?? server.members?.length ?? 0;
      const msg = `🏯 Server Invite: ${server.name}\n${server.description ? server.description + '\n' : ''}👥 ${memberCount} members${server.anime_theme || server.animeTheme ? ' · 🎭 ' + (server.anime_theme || server.animeTheme) : ''}\n\n[server:${server._id || server.id}]`;
      await dmService.sendMessage(convId, msg);
      Alert.alert('Shared!', 'Server card sent to your friend.');
      setShowShareModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to share');
    }
  };

  const handleCreateChannel = async () => {
    if (!channelName.trim() || !server) return;
    const sid = server._id || server.id;
    try {
      await serverService.createChannel({ name: channelName.trim(), serverId: sid });
      setChannelName('');
      setShowNewChannel(false);
      refetchChannels();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to create channel');
    }
  };

  const handleSaveSettings = async () => {
    if (!server) return;
    const sid = server._id || server.id;
    try {
      await serverService.updateSettings(sid, {
        allow_member_chat: allowChat,
        allow_member_post: allowPost,
        allow_member_invite: allowInvite,
      });
      refetchServer();
      Alert.alert('Saved', 'Server settings updated.');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to update settings');
    }
  };

  const handleRoleChange = async (targetUserId: string, role: string) => {
    if (!server) return;
    const sid = server._id || server.id;
    try {
      await serverService.updateMemberRole(sid, targetUserId, role);
      refetchServer();
      setMemberActionModal(null);
      Alert.alert('Updated', `Role changed to ${role}.`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed');
    }
  };

  const handleKickMember = async (targetUserId: string) => {
    if (!server) return;
    const sid = server._id || server.id;
    Alert.alert('Kick Member', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Kick',
        style: 'destructive',
        onPress: async () => {
          try {
            await serverService.kickMember(sid, targetUserId);
            refetchServer();
            setMemberActionModal(null);
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed');
          }
        },
      },
    ]);
  };

  const handleDeleteServer = () => {
    if (!server) return;
    const sid = server._id || server.id;
    Alert.alert(
      'Delete Server',
      'This action is irreversible. Delete this server and all its data?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await serverService.deleteServer(sid);
              queryClient.invalidateQueries({ queryKey: ['servers'] });
              safeGoBack('/(modals)/messages');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed');
            }
          },
        },
      ]
    );
  };

  /* ── Loading ── */
  if (serverLoading || !server) {
    return (
      <View style={[st.root, { paddingTop: insets.top }]}>
        <View style={st.centered}>
          <Text style={st.mutedText}>Loading server…</Text>
        </View>
      </View>
    );
  }

  const serverIcon = server.name?.charAt(0)?.toUpperCase() || '?';
  const hasServerImage = !!server.icon && !server.icon.includes('dicebear');

  /* ── Channel list ── */
  const renderChannels = () => (
    <View style={{ marginTop: 8 }}>
      {isAdmin && (
        <>
          {showNewChannel ? (
            <View style={st.newChannelRow}>
              <TextInput
                value={channelName}
                onChangeText={setChannelName}
                placeholder="Channel name…"
                placeholderTextColor="rgba(255,255,255,0.25)"
                style={st.newChannelInput}
                autoFocus
                maxLength={80}
                onSubmitEditing={handleCreateChannel}
              />
              <TouchableOpacity onPress={handleCreateChannel} style={st.newChannelBtn}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowNewChannel(false)}
                style={st.newChannelCancel}
              >
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={st.addChannelBtn}
              onPress={() => setShowNewChannel(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={20} color="#818cf8" />
              <Text style={st.addChannelText}>Add Channel</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {channelsLoading ? (
        <Text style={[st.mutedText, { textAlign: 'center', paddingTop: 40 }]}>
          Loading channels…
        </Text>
      ) : channels.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 50 }}>
          <Ionicons name="chatbubbles-outline" size={52} color="rgba(255,255,255,0.12)" />
          <Text style={[st.mutedText, { marginTop: 12 }]}>No channels yet</Text>
        </View>
      ) : (
        channels.map((ch: Channel) => (
          <TouchableOpacity
            key={ch._id || ch.id}
            style={st.channelRow}
            activeOpacity={0.7}
            onPress={() =>
              router.push({
                pathname: '/(modals)/chat/[channelId]',
                params: {
                  channelId: ch._id || ch.id,
                  serverName: server.name,
                  channelName: ch.name,
                },
              } as any)
            }
          >
            <Ionicons
              name={ch.type === 'voice' ? 'volume-high-outline' : 'chatbubble-outline'}
              size={18}
              color="rgba(255,255,255,0.4)"
            />
            <Text style={st.channelName}># {ch.name}</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.15)" />
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  /* ── Members list ── */
  const renderMembers = () => {
    const members = server.members || [];
    return (
      <View style={{ marginTop: 8 }}>
        <Text style={st.sectionCount}>
          {server.member_count ?? members.length} members
        </Text>
        {members.map((member: any, idx: number) => {
          const memberUser = typeof member.user === 'string' ? null : member.user;
          if (!memberUser) return null;
          const memId = memberUser.id || memberUser._id;
          const memAvatarSrc = getAvatarSource(memberUser.avatar);
          const isThisOwner =
            memId ===
            (server.owner_id ||
              (typeof server.owner === 'string' ? server.owner : server.owner?.id));

          return (
            <TouchableOpacity
              key={idx}
              style={st.memberRow}
              activeOpacity={0.7}
              onPress={() => {
                if (isAdmin && memId !== userId) {
                  setMemberActionModal({
                    ...memberUser,
                    role: member.role,
                    isOwner: isThisOwner,
                  });
                }
              }}
            >
              {memAvatarSrc ? (
                <Image source={memAvatarSrc} style={st.memberAvatar} />
              ) : (
                <View
                  style={[
                    st.memberAvatar,
                    {
                      backgroundColor: 'rgba(99,102,241,0.25)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                  ]}
                >
                  <Ionicons name="person" size={16} color="rgba(255,255,255,0.5)" />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={st.memberName}>
                  {memberUser.display_name || memberUser.username}
                </Text>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}
                >
                  <View
                    style={[
                      st.onlineDot,
                      {
                        backgroundColor: memberUser.is_online ? '#22c55e' : '#4b5563',
                      },
                    ]}
                  />
                  <View
                    style={[
                      st.roleBadge,
                      isThisOwner && { backgroundColor: 'rgba(234,179,8,0.15)' },
                      member.role === 'admin' && {
                        backgroundColor: 'rgba(99,102,241,0.15)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        st.roleBadgeText,
                        isThisOwner && { color: '#eab308' },
                        member.role === 'admin' && { color: '#818cf8' },
                      ]}
                    >
                      {isThisOwner ? 'Owner' : member.role}
                    </Text>
                  </View>
                </View>
              </View>
              {isAdmin && memId !== userId && (
                <Ionicons name="ellipsis-vertical" size={18} color="rgba(255,255,255,0.3)" />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  /* ── Join Requests panel (admin only) ── */
  const renderJoinRequests = () => (
    <View style={{ marginTop: 8 }}>
      {/* Add Member button */}
      <TouchableOpacity
        style={st.addChannelBtn}
        onPress={() => setShowAddMemberModal(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="person-add-outline" size={18} color="#818cf8" />
        <Text style={st.addChannelText}>Add a Friend</Text>
      </TouchableOpacity>

      <Text style={st.settingsLabel}>
        PENDING REQUESTS ({joinRequests.length})
      </Text>

      {joinRequests.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <Ionicons name="checkmark-circle-outline" size={48} color="rgba(255,255,255,0.12)" />
          <Text style={[st.mutedText, { marginTop: 12 }]}>No pending requests</Text>
        </View>
      ) : (
        joinRequests.map((req: any) => {
          const reqUser = req.user || {};
          const avatarSrc = getAvatarSource(reqUser.avatar);
          return (
            <View key={req.id || req._id} style={st.requestRow}>
              <View style={st.requestUserInfo}>
                {avatarSrc ? (
                  <Image source={avatarSrc} style={st.memberAvatar} />
                ) : (
                  <View style={[st.memberAvatar, { backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                      {(reqUser.display_name || reqUser.username || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={st.memberName}>{reqUser.display_name || reqUser.username || 'User'}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                    @{reqUser.username || 'unknown'}
                  </Text>
                </View>
              </View>
              <View style={st.requestActions}>
                <TouchableOpacity
                  style={st.approveBtn}
                  onPress={() => handleApproveRequest(req.id || req._id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={st.rejectBtn}
                  onPress={() => handleRejectRequest(req.id || req._id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  /* ── Settings panel ── */
  const renderSettings = () => (
    <View style={{ marginTop: 8 }}>
      {!isAdmin ? (
        <View style={{ alignItems: 'center', paddingTop: 50 }}>
          <Ionicons name="lock-closed-outline" size={48} color="rgba(255,255,255,0.12)" />
          <Text style={[st.mutedText, { marginTop: 12 }]}>
            Only admins can change settings
          </Text>
        </View>
      ) : (
        <>
          <Text style={st.settingsLabel}>PERMISSIONS</Text>
          <View style={st.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.settingTitle}>Members can chat</Text>
              <Text style={st.settingDesc}>
                Allow non-admin members to send messages in channels
              </Text>
            </View>
            <Switch
              value={allowChat}
              onValueChange={setAllowChat}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(99,102,241,0.4)' }}
              thumbColor={allowChat ? '#6366f1' : '#6b7280'}
            />
          </View>
          <View style={st.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.settingTitle}>Members can post</Text>
              <Text style={st.settingDesc}>
                Allow non-admin members to create posts in the server
              </Text>
            </View>
            <Switch
              value={allowPost}
              onValueChange={setAllowPost}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(99,102,241,0.4)' }}
              thumbColor={allowPost ? '#6366f1' : '#6b7280'}
            />
          </View>
          <View style={st.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.settingTitle}>Members can invite</Text>
              <Text style={st.settingDesc}>
                Allow non-admin members to invite others to the server
              </Text>
            </View>
            <Switch
              value={allowInvite}
              onValueChange={setAllowInvite}
              trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(99,102,241,0.4)' }}
              thumbColor={allowInvite ? '#6366f1' : '#6b7280'}
            />
          </View>

          <TouchableOpacity
            style={st.saveSettingsBtn}
            onPress={handleSaveSettings}
            activeOpacity={0.7}
          >
            <Ionicons name="save-outline" size={18} color="#fff" />
            <Text style={st.saveSettingsBtnText}>Save Settings</Text>
          </TouchableOpacity>

          {/* Danger Zone */}
          {isOwner && (
            <>
              <Text style={[st.settingsLabel, { marginTop: 28, color: '#ef4444' }]}>
                DANGER ZONE
              </Text>
              <TouchableOpacity
                style={st.dangerBtn}
                onPress={handleDeleteServer}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
                <Text style={st.dangerBtnText}>Delete Server</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </View>
  );

  /* ── Member action modal ── */
  const renderMemberActionModal = () => {
    if (!memberActionModal) return null;
    const m = memberActionModal;
    return (
      <Modal
        visible
        transparent
        animationType="fade"
        onRequestClose={() => setMemberActionModal(null)}
      >
        <TouchableOpacity
          style={st.modalOverlay}
          activeOpacity={1}
          onPress={() => setMemberActionModal(null)}
        >
          <View style={st.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={st.modalTitle}>{m.display_name || m.username}</Text>
            <Text style={st.modalSubtitle}>
              Current role: {m.isOwner ? 'Owner' : m.role}
            </Text>

            {!m.isOwner && (
              <>
                <Text style={[st.settingsLabel, { marginTop: 16 }]}>CHANGE ROLE</Text>
                {['admin', 'moderator', 'member']
                  .filter((r) => r !== m.role)
                  .map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={st.modalOption}
                      onPress={() => handleRoleChange(m.id || m._id, r)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={
                          r === 'admin'
                            ? 'shield-checkmark-outline'
                            : r === 'moderator'
                            ? 'shield-outline'
                            : 'person-outline'
                        }
                        size={20}
                        color={r === 'admin' ? '#818cf8' : 'rgba(255,255,255,0.5)'}
                      />
                      <Text
                        style={[st.modalOptionText, r === 'admin' && { color: '#818cf8' }]}
                      >
                        Make {r.charAt(0).toUpperCase() + r.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                <View style={{ height: 12 }} />
                <TouchableOpacity
                  style={[st.modalOption, { borderColor: 'rgba(239,68,68,0.2)' }]}
                  onPress={() => handleKickMember(m.id || m._id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="person-remove-outline" size={20} color="#ef4444" />
                  <Text style={[st.modalOptionText, { color: '#ef4444' }]}>
                    Kick from server
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={st.modalCloseBtn}
              onPress={() => setMemberActionModal(null)}
              activeOpacity={0.7}
            >
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => safeGoBack('/(modals)/messages')} style={st.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        {hasServerImage ? (
          <Image source={{ uri: server.icon }} style={{ width: 40, height: 40, borderRadius: 12, marginLeft: 12 }} />
        ) : (
          <View style={st.serverIconWrap}>
            <Text style={st.serverIconText}>{serverIcon}</Text>
          </View>
        )}

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={st.serverName} numberOfLines={1}>
            {server.name}
          </Text>
          <Text style={st.serverMeta}>
            {server.member_count ?? server.members?.length ?? 0} members
            {server.is_public === false || server.isPublic === false ? ' · Private' : ''}
          </Text>
        </View>

        {/* Share button */}
        <TouchableOpacity
          style={st.shareBtn}
          onPress={() => setShowShareModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="share-social-outline" size={18} color="#818cf8" />
        </TouchableOpacity>

        {!isMember ? (
          joinStatus?.status === 'pending' ? (
            <View style={[st.joinBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
              <Text style={[st.joinBtnText, { color: 'rgba(255,255,255,0.4)' }]}>⏳ Pending</Text>
            </View>
          ) : (
            <TouchableOpacity style={st.joinBtn} onPress={handleJoinLeave} activeOpacity={0.7}>
              <Text style={st.joinBtnText}>Request to Join</Text>
            </TouchableOpacity>
          )
        ) : !isOwner ? (
          <TouchableOpacity style={st.leaveBtn} onPress={handleJoinLeave} activeOpacity={0.7}>
            <Ionicons name="exit-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Description & tags */}
      {server.description ? (
        <View style={st.descWrap}>
          <Text style={st.descText}>{server.description}</Text>
          {(server.tags?.length > 0 || server.anime_theme || server.animeTheme) && (
            <View style={st.tagRow}>
              {(server.anime_theme || server.animeTheme) && (
                <View style={st.themeTag}>
                  <Ionicons name="star" size={12} color="#ec4899" />
                  <Text style={st.themeTagText}>
                    {server.anime_theme || server.animeTheme}
                  </Text>
                </View>
              )}
              {(server.tags || []).map((tag: string) => (
                <View key={tag} style={st.tag}>
                  <Text style={st.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {/* Tab bar */}
      {isMember && (
        <View style={st.tabBar}>
          {(
            ['channels', 'members', ...(isAdmin ? ['requests', 'settings'] : [])] as Tab[]
          ).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[st.tab, activeTab === tab && st.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={
                  tab === 'channels'
                    ? 'chatbubbles-outline'
                    : tab === 'members'
                    ? 'people-outline'
                    : tab === 'requests'
                    ? 'person-add-outline'
                    : 'settings-outline'
                }
                size={18}
                color={activeTab === tab ? '#818cf8' : 'rgba(255,255,255,0.4)'}
              />
              <Text style={[st.tabText, activeTab === tab && st.tabTextActive]}>
                {tab === 'requests' ? `Requests${joinRequests.length ? ` (${joinRequests.length})` : ''}` : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Content */}
      {isMember ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
        >
          {activeTab === 'channels' && renderChannels()}
          {activeTab === 'members' && renderMembers()}
          {activeTab === 'requests' && renderJoinRequests()}
          {activeTab === 'settings' && renderSettings()}
        </ScrollView>
      ) : (
        <View style={st.centered}>
          <Ionicons name="lock-closed-outline" size={56} color="rgba(255,255,255,0.12)" />
          {joinStatus?.status === 'pending' ? (
            <>
              <Text style={[st.mutedText, { fontSize: 16, fontWeight: '600', marginTop: 14 }]}>
                Request Pending
              </Text>
              <Text style={[st.mutedText, { marginTop: 6, textAlign: 'center' }]}>
                Your join request is awaiting admin approval. You'll be able to access the server once approved.
              </Text>
            </>
          ) : (
            <>
              <Text
                style={[st.mutedText, { fontSize: 16, fontWeight: '600', marginTop: 14 }]}
              >
                Request to join this server
              </Text>
              <Text style={[st.mutedText, { marginTop: 6 }]}>
                The admin will review your request to join
              </Text>
            </>
          )}
        </View>
      )}

      {renderMemberActionModal()}

      {/* Add Member Modal */}
      <Modal
        visible={showAddMemberModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddMemberModal(false)}
      >
        <TouchableOpacity
          style={st.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddMemberModal(false)}
        >
          <View style={[st.modalContent, { maxHeight: 420 }]} onStartShouldSetResponder={() => true}>
            <Text style={st.modalTitle}>Add a Friend</Text>
            <Text style={st.modalSubtitle}>
              Select a friend to add to this server
            </Text>
            <ScrollView style={{ marginTop: 16, maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {(() => {
                const existingMemberIds = (server?.members || []).map((m: any) =>
                  typeof m.user === 'string' ? m.user : m.user?.id || m.user?._id
                );
                const addable = friendsList.filter(
                  (f: any) => !existingMemberIds.includes(f.id || f._id)
                );
                if (addable.length === 0) {
                  return (
                    <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                      <Ionicons name="people-outline" size={36} color="rgba(255,255,255,0.12)" />
                      <Text style={[st.mutedText, { marginTop: 8 }]}>
                        No friends to add
                      </Text>
                    </View>
                  );
                }
                return addable.map((friend: any) => {
                  const fAvatar = getAvatarSource(friend.avatar);
                  return (
                    <TouchableOpacity
                      key={friend.id || friend._id}
                      style={st.addMemberRow}
                      onPress={() => handleAddMember(friend.id || friend._id)}
                      activeOpacity={0.7}
                    >
                      {fAvatar ? (
                        <Image source={fAvatar} style={{ width: 36, height: 36, borderRadius: 18 }} />
                      ) : (
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: '700' }}>
                            {(friend.display_name || friend.username || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                          {friend.display_name || friend.username}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                          @{friend.username}
                        </Text>
                      </View>
                      <Ionicons name="add-circle-outline" size={22} color="#6366f1" />
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>
            <TouchableOpacity
              style={st.modalCloseBtn}
              onPress={() => setShowAddMemberModal(false)}
              activeOpacity={0.7}
            >
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Share Server Modal */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowShareModal(false)}
      >
        <TouchableOpacity
          style={st.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowShareModal(false)}
        >
          <View style={[st.modalContent, { maxHeight: 420 }]} onStartShouldSetResponder={() => true}>
            <Text style={st.modalTitle}>Share Server</Text>
            <Text style={st.modalSubtitle}>
              Send a server card to a friend via DM
            </Text>

            {/* Server card preview */}
            <View style={st.sharePreview}>
              {hasServerImage ? (
                <Image source={{ uri: server.icon }} style={{ width: 32, height: 32, borderRadius: 10 }} />
              ) : (
                <View style={[st.serverIconWrap, { width: 32, height: 32, borderRadius: 10 }]}>
                  <Text style={[st.serverIconText, { fontSize: 14 }]}>{serverIcon}</Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{server.name}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
                  👥 {server.member_count ?? server.members?.length ?? 0} members
                </Text>
              </View>
            </View>

            <ScrollView style={{ marginTop: 12, maxHeight: 240 }} showsVerticalScrollIndicator={false}>
              {friendsList.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                  <Ionicons name="people-outline" size={36} color="rgba(255,255,255,0.12)" />
                  <Text style={[st.mutedText, { marginTop: 8 }]}>No friends to share with</Text>
                </View>
              ) : (
                friendsList.map((friend: any) => {
                  const fAvatar = getAvatarSource(friend.avatar);
                  return (
                    <TouchableOpacity
                      key={friend.id || friend._id}
                      style={st.addMemberRow}
                      onPress={() => handleShareServer(friend.id || friend._id)}
                      activeOpacity={0.7}
                    >
                      {fAvatar ? (
                        <Image source={fAvatar} style={{ width: 36, height: 36, borderRadius: 18 }} />
                      ) : (
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: '700' }}>
                            {(friend.display_name || friend.username || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                          {friend.display_name || friend.username}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                          @{friend.username}
                        </Text>
                      </View>
                      <Ionicons name="send-outline" size={18} color="#818cf8" />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity
              style={st.modalCloseBtn}
              onPress={() => setShowShareModal(false)}
              activeOpacity={0.7}
            >
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a14' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  mutedText: { color: 'rgba(255,255,255,0.35)', fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  serverIconText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  serverName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  serverMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 },

  joinBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  leaveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  descWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  descText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 19 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  themeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(236,72,153,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  themeTagText: { color: '#ec4899', fontSize: 12, fontWeight: '600' },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tagText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 6,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tabActive: { backgroundColor: 'rgba(99,102,241,0.12)' },
  tabText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#818cf8' },

  /* Channels */
  addChannelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.2)',
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  addChannelText: { color: '#818cf8', fontWeight: '600', fontSize: 14 },
  newChannelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  newChannelInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
  },
  newChannelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChannelCancel: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  channelName: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 15 },

  /* Members */
  sectionCount: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  memberAvatar: { width: 42, height: 42, borderRadius: 21 },
  memberName: { color: '#fff', fontWeight: '600', fontSize: 15 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleBadgeText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },

  /* Settings */
  settingsLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  settingTitle: { color: '#fff', fontWeight: '600', fontSize: 15 },
  settingDesc: { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2, marginRight: 12 },
  saveSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 20,
  },
  saveSettingsBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  dangerBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalSubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  modalOptionText: { color: 'rgba(255,255,255,0.7)', fontWeight: '600', fontSize: 14 },
  modalCloseBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 10 },

  /* Join Requests */
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  requestUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  rejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  addMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(99,102,241,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sharePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99,102,241,0.08)',
    borderRadius: 12,
    padding: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.15)',
  },
});