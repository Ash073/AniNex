import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService, Notification } from '@/services/notificationService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';

/** Relative timestamp helper */
function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function notifIcon(type: string) {
  switch (type) {
    case 'server_added':
      return { name: 'people' as const, color: '#818cf8' };
    case 'server_approved':
      return { name: 'checkmark-circle' as const, color: '#34d399' };
    case 'friend_request':
      return { name: 'person-add' as const, color: '#f472b6' };
    case 'post_like':
      return { name: 'heart' as const, color: '#ec4899' };
    case 'post_comment':
      return { name: 'chatbubble' as const, color: '#6366f1' };
    default:
      return { name: 'notifications' as const, color: '#fbbf24' };
  }
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.getNotifications(),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => notificationService.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
    },
  });

  const deleteAllNotificationsMutation = useMutation({
    mutationFn: () => notificationService.deleteAllNotifications(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    setRefreshing(false);
  }, [queryClient]);

  const handleNotifPress = (notif: Notification) => {
    // Mark as read
    if (!notif.is_read) {
      markReadMutation.mutate(notif.id);
    }
    // Navigate based on type
    if ((notif.type === 'server_added' || notif.type === 'server_approved') && notif.data?.server_id) {
      router.push(`/(modals)/server/${notif.data.server_id}` as any);
    } else if (notif.type === 'friend_request' && notif.data?.sender_id) {
      router.push(`/(modals)/user-profile?userId=${notif.data.sender_id}` as any);
    } else if ((notif.type === 'post_like' || notif.type === 'post_comment') && notif.data?.post_id) {
      router.push(`/(modals)/post/${notif.data.post_id}` as any);
    }
  };

  const handleDeleteNotification = (id: string, title: string) => {
    Alert.alert(
      'Delete Notification',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteNotificationMutation.mutate(id),
        },
      ]
    );
  };

  const handleDeleteAllNotifications = () => {
    Alert.alert(
      'Delete All Notifications',
      'Are you sure you want to delete all notifications? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: () => deleteAllNotificationsMutation.mutate(),
        },
      ]
    );
  };

  const unreadCount = notifications.filter((n: Notification) => !n.is_read).length;

  const renderNotification = ({ item }: { item: Notification }) => {
    const icon = notifIcon(item.type);
    return (
      <TouchableOpacity
        style={[ns.notifCard, !item.is_read && ns.notifUnread]}
        onPress={() => handleNotifPress(item)}
        onLongPress={() => handleDeleteNotification(item.id, item.title)}
        activeOpacity={0.7}
      >
        <View style={[ns.iconCircle, { backgroundColor: `${icon.color}20` }]}>
          <Ionicons name={icon.name} size={20} color={icon.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={ns.notifTitle}>{item.title}</Text>
          <Text style={ns.notifBody} numberOfLines={2}>{item.body}</Text>
          <Text style={ns.notifTime}>{timeAgo(item.created_at)}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {!item.is_read && <View style={ns.unreadDot} />}
          <TouchableOpacity
            onPress={() => handleDeleteNotification(item.id, item.title)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 8, padding: 4 }}
          >
            <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={ns.center}>
      <Ionicons name="notifications-off-outline" size={48} color="rgba(255,255,255,0.2)" />
      <Text style={ns.emptyText}>No notifications yet</Text>
      <Text style={ns.emptySubtext}>Interactions with other users will appear here</Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={ns.center}>
      <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.2)" />
      <Text style={ns.emptyText}>Failed to load notifications</Text>
      <TouchableOpacity 
        onPress={onRefresh} 
        style={ns.retryButton}
        activeOpacity={0.7}
      >
        <Text style={ns.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[ns.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={ns.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={ns.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={ns.headerTitle}>Notifications</Text>
        {notifications.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={() => markAllReadMutation.mutate()}
                activeOpacity={0.7}
                style={ns.markAllBtn}
                disabled={markAllReadMutation.isPending}
              >
                {markAllReadMutation.isPending ? (
                  <ActivityIndicator size="small" color="#818cf8" />
                ) : (
                  <Text style={ns.markAllText}>Mark all read</Text>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={handleDeleteAllNotifications}
              activeOpacity={0.7}
              style={ns.deleteAllBtn}
              disabled={deleteAllNotificationsMutation.isPending}
            >
              {deleteAllNotificationsMutation.isPending ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={ns.center}>
          <ActivityIndicator size="large" color="#818cf8" />
          <Text style={ns.loadingText}>Loading notifications...</Text>
        </View>
      ) : notifications.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#818cf8"
              colors={['#818cf8']}
            />
          }
          ListEmptyComponent={renderEmptyState}
        />
      )}
    </View>
  );
}

const ns = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a14' },
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
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(129,140,248,0.15)',
  },
  markAllText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteAllBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 15,
    marginTop: 12,
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 250,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(129,140,248,0.2)',
  },
  retryText: {
    color: '#818cf8',
    fontSize: 14,
    fontWeight: '600',
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  notifUnread: {
    backgroundColor: 'rgba(129,140,248,0.08)',
    borderColor: 'rgba(129,140,248,0.2)',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  notifBody: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    marginTop: 2,
  },
  notifTime: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#818cf8',
  },
});