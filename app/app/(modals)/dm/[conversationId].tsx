import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  Alert,
  PanResponder,
  Animated,
  Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dmService } from '@/services/dmService';
import { socketService } from '@/services/socketService';
import { userService } from '@/services/userService';
import { useAuthStore } from '@/store/authStore';
import { DirectMessage } from '@/types';
import DMPostPreview from './DMPostPreview';
import ServerInviteCard, { extractServerInviteId, stripServerInviteText } from '@/components/ServerInviteCard';

// --- Extended Types ---
interface ExtendedMessage extends DirectMessage {
  reactions?: string[];
}

// Avatar helpers
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

// --- Components ---

const EmojiPicker = ({ visible, onClose, onSelect }: { visible: boolean, onClose: () => void, onSelect: (emoji: string) => void }) => {
  const emojis = ['❤️', '😂', '😮', '😢', '🙏', '👍', '🔥', '✨'];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.emojiContainer}>
          {emojis.map((emoji) => (
            <TouchableOpacity key={emoji} onPress={() => onSelect(emoji)} style={styles.emojiItem}>
              <Text style={{ fontSize: 28 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const MessageOptionsMenu = ({
  visible,
  onClose,
  onEdit,
  onDelete,
  isOwn
}: {
  visible: boolean,
  onClose: () => void,
  onEdit?: () => void,
  onDelete?: () => void,
  isOwn: boolean
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.optionsSheet}>
          <View style={styles.optionsHeaderLine} />

          {/* Reply removed - only slide to reply */}

          {isOwn && (
            <>
              <TouchableOpacity style={styles.optionItem} onPress={() => { onEdit?.(); onClose(); }}>
                <View style={[styles.optionIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                  <Ionicons name="create-outline" size={22} color="#f59e0b" />
                </View>
                <Text style={styles.optionText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionItem} onPress={() => { onDelete?.(); onClose(); }}>
                <View style={[styles.optionIcon, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                  <Ionicons name="trash-outline" size={22} color="#ef4444" />
                </View>
                <Text style={[styles.optionText, { color: '#ef4444' }]}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const SwipeableMessage = ({ children, onSwipe, isOwn }: { children: React.ReactNode, onSwipe: () => void, isOwn: boolean }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10 && gesture.dx > 0,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx > 0) translateX.setValue(Math.min(gesture.dx, 60));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 40) onSwipe();
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(),
    })
  ).current;

  return (
    <View {...panResponder.panHandlers}>
      <Animated.View style={{ transform: [{ translateX }] }}>{children}</Animated.View>
      <Animated.View style={[styles.swipeIndicator, { opacity: translateX.interpolate({ inputRange: [0, 40], outputRange: [0, 1] }) }]}>
        <Ionicons name="arrow-undo-outline" size={20} color="#6366f1" />
      </Animated.View>
    </View>
  );
};

export default function DMChatScreen() {
  const { conversationId, name, avatar, recipientId } = useLocalSearchParams<{ conversationId: string; name?: string; avatar?: string; recipientId?: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const currentUserId = user?.id || (user as any)?._id;

  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ExtendedMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ExtendedMessage | null>(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);
  const [recipientIsOnline, setRecipientIsOnline] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!conversationId) return;

    const loadRecipientStatus = async () => {
      if (recipientId) {
        try {
          // Check if any message already has the status
          const profile = await userService.getUserById(recipientId);
          setRecipientIsOnline(!!profile.is_online);
        } catch (e) { console.error('Failed to fetch recipient status', e); }
      }
    };

    const loadData = async () => {
      try {
        const msgs = await dmService.getMessages(conversationId);
        setMessages(msgs); // Already newest first from backend

        // If we didn't have recipient info yet, try to find it in messages
        if (!recipientIsOnline && msgs.length > 0) {
          const otherMsg = msgs.find(m => m.sender_id !== currentUserId);
          if (otherMsg?.sender) {
            setRecipientIsOnline(!!otherMsg.sender.is_online);
          }
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    loadRecipientStatus();
    loadData();
    socketService.connect();
    socketService.joinDM(conversationId);

    const onNewMessage = (message: DirectMessage) => {
      if (message.conversation_id === conversationId) {
        setMessages((prev) => [message, ...prev]); // Prepend for inverted list
        dmService.markRead(conversationId).catch(() => { });

        // Update status if sender is the other user
        if (message.sender_id !== currentUserId && message.sender) {
          setRecipientIsOnline(!!message.sender.is_online);
        }
      }
    };

    const onStatusChange = (data: { userId: string, isOnline: boolean }) => {
      if (data.userId === recipientId) {
        setRecipientIsOnline(data.isOnline);
      }
    };

    const onReaction = (data: { messageId: string, reactions: string[] }) => {
      setMessages(prev => prev.map(m =>
        m.id === data.messageId ? { ...m, reactions: data.reactions } : m
      ));
    };

    const onDeleted = (data: { messageId: string, conversationId: string }) => {
      if (data.conversationId === conversationId) {
        setMessages(prev => prev.filter(m => m.id !== data.messageId));
      }
    };

    socketService.on('dm:new', onNewMessage);
    socketService.on('dm:reaction', onReaction);
    socketService.on('user:status', onStatusChange);
    socketService.on('dm:deleted', onDeleted);

    return () => {
      socketService.leaveDM(conversationId);
      socketService.off('dm:new', onNewMessage);
      socketService.off('dm:reaction', onReaction);
      socketService.off('user:status', onStatusChange);
      socketService.off('dm:deleted', onDeleted);
    };
  }, [conversationId, recipientId]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || sending) return;
    const text = inputText.trim();
    const replyId = replyingTo?.id;
    const editId = editingMessage?.id;
    setInputText('');
    setSending(true);
    setReplyingTo(null);
    try {
      if (editId) {
        await dmService.editMessage(editId, text);
        setMessages(prev => prev.map(m => m.id === editId ? { ...m, content: text, is_edited: true } : m));
        setEditingMessage(null);
      } else {
        await dmService.sendMessage(conversationId, text, undefined, replyId);
      }
    } catch (error) { setInputText(text); } finally { setSending(false); }
  };

  const onLongPressMessage = (item: ExtendedMessage) => {
    const isOwn = item.sender_id === currentUserId;
    if (isOwn) {
      setShowOptionsId(item.id);
    } else {
      setShowEmojiPicker(item.id);
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      await dmService.deleteMessage(id);
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch (e) { Alert.alert('Error', 'Could not delete message'); }
  };

  const onSelectEmoji = (emoji: string) => {
    const messageId = showEmojiPicker;
    setShowEmojiPicker(null);
    if (messageId) {
      // Persist to backend
      dmService.addReaction(messageId, emoji).catch(err => console.error('Failed to save reaction:', err));

      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          const currentReactions = m.reactions || [];
          return { ...m, reactions: [...new Set([...currentReactions, emoji])] };
        }
        return m;
      }));
    }
  };

  const renderMessage = ({ item }: { item: ExtendedMessage }) => {
    const isOwn = item.sender_id === currentUserId;
    const postMatch = item.content.match(/\[post:([a-f0-9\-]+)\]/i);
    const postId = postMatch ? postMatch[1] : null;

    const serverId = extractServerInviteId(item.content);

    let filteredContent = item.content;
    if (postId) {
      // Strips the entire "📝 Shared Post by..." block including title, content, and the tag
      filteredContent = filteredContent
        .replace(/📝\s*Shared\s*Post\s*by[\s\S]*?\[post:[a-f0-9\-]+\]/gi, '')
        .trim();
    }
    if (serverId) {
      // Strips the entire "🏯 Server Invite:..." block including title, content, stats and the tag
      filteredContent = filteredContent
        .replace(/🏯\s*Server\s*Invite:[\s\S]*?\[server:[a-zA-Z0-9_-]+\]/si, '')
        .trim();
    }

    const replyMsg = item.replied_to_message || (messages.find(m => m.id === item.replied_to_id));

    return (
      <SwipeableMessage isOwn={isOwn} onSwipe={() => setReplyingTo(item)}>
        <View style={[styles.messageRow, isOwn ? styles.rowOwn : styles.rowOther]}>
          {!isOwn && (
            <TouchableOpacity onPress={() => router.push(`/(modals)/user-profile?userId=${item.sender_id}` as any)}>
              {getAvatarSource(avatar || item.sender?.avatar) ? (
                <Image source={getAvatarSource(avatar || item.sender?.avatar)!} style={styles.messageAvatar} />
              ) : (
                <View style={[styles.messageAvatar, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="person" size={14} color="#666" />
                </View>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            activeOpacity={1}
            onLongPress={() => onLongPressMessage(item)}
            style={{ maxWidth: '85%' }}
          >
            {replyMsg && (
              <View style={[styles.replyBubble, isOwn ? styles.replyOwnContainer : styles.replyOtherContainer]}>
                <View style={[styles.replyBorder, { backgroundColor: isOwn ? 'rgba(255,255,255,0.4)' : '#6366f1' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.replyName} numberOfLines={1}>
                    {replyMsg.sender_id === currentUserId ? 'You' : name}
                  </Text>
                  <Text style={styles.replyText} numberOfLines={1}>{replyMsg.content}</Text>
                </View>
              </View>
            )}

            <View style={{ position: 'relative' }}>
              {filteredContent ? (
                <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther, { marginBottom: (postId || serverId || (item.reactions?.length ?? 0) > 0) ? 12 : 0 }]}>
                  <Text style={[styles.messageText, isOwn ? styles.textOwn : styles.textOther]}>{filteredContent}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 2 }}>
                    {item.is_edited && <Text style={[styles.timeText, { marginRight: 4 }]}>edited</Text>}
                    <Text style={styles.timeText}>
                      {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              ) : null}

              {postId && <DMPostPreview postId={postId} isOwn={isOwn} createdAt={item.created_at} />}
              {serverId && <ServerInviteCard serverId={serverId} />}

              {/* Reaction Badges */}
              {item.reactions && item.reactions.length > 0 && (
                <View style={[styles.reactionContainer, isOwn ? { right: 0 } : { left: 0 }]}>
                  {item.reactions.map((emoji, idx) => (
                    <View key={idx} style={styles.reactionBadge}>
                      <Text style={{ fontSize: 13 }}>{emoji}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </SwipeableMessage>
    );
  };

  const selectedOptionsMsg = messages.find(m => m.id === showOptionsId);

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerInfoContainer}
            activeOpacity={0.7}
            onPress={() => recipientId && router.push(`/(modals)/user-profile?userId=${recipientId}` as any)}
          >
            {getAvatarSource(avatar) ? (
              <Image source={getAvatarSource(avatar)!} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person" size={18} color="#666" />
              </View>
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.headerName} numberOfLines={1}>{name || 'Chat'}</Text>
              <Text style={[styles.statusText, !recipientIsOnline && { color: 'rgba(255,255,255,0.4)' }]}>
                {recipientIsOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerAction}>
            <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }}>
          {loading ? (<ActivityIndicator style={{ marginTop: 20 }} color="#6366f1" />) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              inverted
            />
          )}
        </View>

        {(replyingTo || editingMessage) && (
          <View style={styles.replyingBar}>
            <View style={styles.replyingContent}>
              <View style={[styles.replyingLine, { backgroundColor: editingMessage ? '#f59e0b' : '#6366f1' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.replyingTitle, editingMessage && { color: '#f59e0b' }]}>
                  {editingMessage ? 'Editing message' : `Replying to ${replyingTo?.sender_id === currentUserId ? 'yourself' : name}`}
                </Text>
                <Text style={styles.replyingText} numberOfLines={1}>{(replyingTo || editingMessage)?.content}</Text>
              </View>
              <TouchableOpacity onPress={() => { setReplyingTo(null); setEditingMessage(null); setInputText(''); }}>
                <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={styles.attachBtn}><Ionicons name="add" size={24} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={editingMessage ? "Edit message..." : "Write a message..."}
            placeholderTextColor="rgba(255,255,255,0.4)"
            multiline
          />
          <TouchableOpacity onPress={handleSendMessage} disabled={!inputText.trim() || sending} style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <EmojiPicker visible={!!showEmojiPicker} onClose={() => setShowEmojiPicker(null)} onSelect={onSelectEmoji} />

      <MessageOptionsMenu
        visible={!!showOptionsId}
        onClose={() => setShowOptionsId(null)}
        isOwn={selectedOptionsMsg?.sender_id === currentUserId}
        onEdit={() => {
          if (selectedOptionsMsg) {
            setEditingMessage(selectedOptionsMsg);
            setInputText(selectedOptionsMsg.content);
          }
        }}
        onDelete={() => selectedOptionsMsg && deleteMessage(selectedOptionsMsg.id)}
      />

      {/* Floating React Button removed - logic merged into long-press */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1e' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backButton: { padding: 8 },
  headerInfoContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, marginLeft: 8 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 8 },
  messageAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
  headerInfo: { flex: 1, marginLeft: 4 },
  headerName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  statusText: { color: '#22c55e', fontSize: 12 },
  headerAction: { padding: 8 },
  listContent: { paddingHorizontal: 16, paddingVertical: 20 },
  messageRow: { marginBottom: 16, flexDirection: 'row' },
  rowOwn: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleOwn: { backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: 'rgba(255,255,255,0.08)', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 20, color: '#fff' },
  textOwn: {},
  textOther: {},
  timeText: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, backgroundColor: '#18181b', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  attachBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, color: '#fff', fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },

  swipeIndicator: { position: 'absolute', left: -30, top: '50%', marginTop: -10 },
  replyBubble: { padding: 8, borderRadius: 10, marginBottom: -6, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', maxWidth: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  replyOwnContainer: { alignSelf: 'flex-end', marginRight: 4 },
  replyOtherContainer: { alignSelf: 'flex-start', marginLeft: 4 },
  replyBorder: { width: 3, borderRadius: 2, marginRight: 8 },
  replyName: { color: '#6366f1', fontSize: 11, fontWeight: '700', marginBottom: 2 },
  replyText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },

  replyingBar: { backgroundColor: '#18181b', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  replyingContent: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 8, borderRadius: 8 },
  replyingLine: { width: 3, height: '100%', backgroundColor: '#6366f1', borderRadius: 2, marginRight: 12 },
  replyingTitle: { color: '#6366f1', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  replyingText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  emojiContainer: { flexDirection: 'row', backgroundColor: '#262626', padding: 16, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignSelf: 'center', marginBottom: 100 },
  emojiItem: { paddingHorizontal: 8 },

  // Custom Options Modal
  optionsSheet: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  optionsHeaderLine: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  optionText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  reactionContainer: { position: 'absolute', bottom: -10, flexDirection: 'row', gap: 4, zIndex: 10 },
  reactionBadge: { backgroundColor: '#262626', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 2 },
  floatingReactBtn: { position: 'absolute', bottom: 180, right: 30, backgroundColor: '#1a1a2e', width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#6366f1', elevation: 5 },
});