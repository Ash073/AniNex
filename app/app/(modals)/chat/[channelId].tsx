import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { chatService } from '@/services/chatService';
import { useChatStore } from '@/store/chatStore';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/authStore';
import { uploadImage } from '@/services/uploadService';
import { Message } from '@/types';
import { safeGoBack } from '@/utils/navigation';
import { useNavigationTracking } from '@/hooks/navigationHistory';

const EmojiPicker = ({ visible, onClose, onSelect }: { visible: boolean, onClose: () => void, onSelect: (emoji: string) => void }) => {
  const emojis = ['❤️', '😂', '😮', '😢', '🙏', '👍', '🔥', '✨'];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={cs.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={cs.emojiPickerContainer}>
          {emojis.map((emoji) => (
            <TouchableOpacity key={emoji} onPress={() => onSelect(emoji)} style={cs.emojiItem}>
              <Text style={{ fontSize: 28 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default function ChatScreen() {
  const { channelId, channelName, serverName } = useLocalSearchParams<{
    channelId: string;
    channelName?: string;
    serverName?: string;
  }>();
  // Robust DM detection: If serverName is missing, empty, or channelName is 'dm', treat as DM
  const isDM = !serverName || serverName.toLowerCase().includes('dm') || serverName.toLowerCase().includes('direct') || (channelName && channelName.toLowerCase().includes('dm'));
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const userId = user?.id || user?._id;
  // Removed duplicate declaration of channelMessages and otherUser
  const [messageText, setMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [isEditingModalVisible, setIsEditingModalVisible] = useState(false);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useNavigationTracking(`/chat/${channelId}`);

  const { messages, typingUsers } = useChatStore();
  const { sendMessage, joinChannel, leaveChannel, startTyping, stopTyping } = useSocket();

  const channelMessages = messages[channelId] || [];

  const { data: initialMessages } = useQuery({
    queryKey: ['messages', channelId],
    queryFn: () => chatService.getMessages(channelId),
    enabled: !!channelId,
  });

  useEffect(() => {
    if (initialMessages) {
      useChatStore.getState().setMessages(channelId, initialMessages);
    }
  }, [initialMessages, channelId]);

  useEffect(() => {
    if (channelId) {
      joinChannel(channelId);
      return () => leaveChannel(channelId);
    }
  }, [channelId]);

  const handleSend = () => {
    if (!messageText.trim()) return;

    if (editingMessage) {
      // Handle message editing via REST (needs to update existing record)
      chatService.editMessage(editingMessage.id, messageText.trim())
        .then(updatedMessage => {
          // Update the message in the store
          const updatedMessages = channelMessages.map(msg =>
            msg.id === updatedMessage.id ? updatedMessage : msg
          );
          useChatStore.getState().setMessages(channelId, updatedMessages);

          setEditingMessage(null);
          setMessageText('');
          stopTyping(channelId);
          setIsTyping(false);
        })
        .catch(error => {
          Alert.alert('Error', 'Failed to edit message');
          console.error('Edit message error:', error);
        });
    } else {
      // Send message via socket (reliable real-time delivery)
      const content = messageText.trim();
      const repliedToId = replyingToMessage?.id;

      // Optimistic UI: add message to store immediately so user sees it
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMessage: Message = {
        id: optimisticId,
        content,
        channel: channelId,
        channel_id: channelId,
        author_id: userId,
        author: {
          id: userId,
          username: user?.username || 'You',
          avatar: user?.avatar || '',
          is_online: true,
        },
        attachments: [],
        reactions: [],
        created_at: new Date().toISOString(),
        replied_to_id: repliedToId,
        replied_to_message: replyingToMessage ? {
          id: replyingToMessage.id,
          content: replyingToMessage.content,
          author: replyingToMessage.author,
        } : undefined,
      } as any;

      useChatStore.getState().addMessage(channelId, optimisticMessage);

      // Send via socket
      sendMessage(channelId, content, undefined, repliedToId);

      // Clear input immediately
      setMessageText('');
      setReplyingToMessage(null);
      stopTyping(channelId);
      setIsTyping(false);
    }
  };

  const handleEdit = (message: Message) => {
    if (message.author_id === userId || message.author?._id === userId) {
      setEditingMessage(message);
      setMessageText(message.content);
      setIsEditingModalVisible(true);
    }
  };

  const handleDelete = (message: Message) => {
    if (message.author_id === userId || message.author?._id === userId) {
      Alert.alert(
        'Confirm Delete',
        'Are you sure you want to delete this message?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              chatService.deleteMessage(message.id)
                .then(() => {
                  // Remove the message from the store
                  const updatedMessages = channelMessages.filter(msg => msg.id !== message.id);
                  useChatStore.getState().setMessages(channelId, updatedMessages);
                })
                .catch(error => {
                  Alert.alert('Error', 'Failed to delete message');
                  console.error('Delete message error:', error);
                });
            }
          }
        ]
      );
    }
  };

  const handleReply = (message: Message) => {
    setReplyingToMessage(message);
    // Focus on input and add mention
    setMessageText(`@${message.author?.username || 'User'} `);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setMessageText('');
    setIsEditingModalVisible(false);
  };

  const cancelReply = () => {
    setReplyingToMessage(null);
  };

  const handleLongPress = (message: Message) => {
    setSelectedMessage(message);
    setContextMenuVisible(true);
  };

  const closeContextMenu = () => {
    setContextMenuVisible(false);
    setSelectedMessage(null);
  };

  const pickAndSendImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow access to your photos to send images');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setUploading(true);
      try {
        const publicUrl = await uploadImage(result.assets[0].uri);
        sendMessage(channelId, '', publicUrl);
      } catch (e) {
        console.error('Image upload failed', e);
        Alert.alert('Upload failed', 'Could not send image.');
      } finally {
        setUploading(false);
      }
    } catch (e) {
      console.error('Image picker error', e);
    }
  }, [channelId, sendMessage]);

  const handleTyping = (text: string) => {
    setMessageText(text);
    if (!isTyping && text.length > 0) {
      setIsTyping(true);
      startTyping(channelId);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      stopTyping(channelId);
    }, 2000);
  };

  const handleSelectEmoji = (emoji: string) => {
    if (!selectedMessage) return;

    chatService.addReaction(selectedMessage.id, emoji)
      .then(() => {
        // Update the message in the store
        const currentReactions = selectedMessage.reactions || [];
        const newReactions = [...new Set([...currentReactions, emoji])];
        const updatedMessages = channelMessages.map(msg =>
          msg.id === selectedMessage.id ? { ...msg, reactions: newReactions } : msg
        );
        useChatStore.getState().setMessages(channelId, updatedMessages);
        setShowEmojiPicker(false);
        closeContextMenu();
      })
      .catch(error => {
        console.error('Failed to add reaction:', error);
      });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const authorId = item.author?.id || item.author?._id || item.author_id;
    const isOwn = authorId === userId;
    const attachImg = item.attachments?.find((a: any) => a.type === 'image');

    // Parse mentions from content
    const parseMentions = (text: string) => {
      const mentionRegex = /\[@(\w+)\]\(user:([a-f0-9-]+)\)/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = mentionRegex.exec(text)) !== null) {
        // Add text before mention
        if (match.index > lastIndex) {
          parts.push(
            <Text key={`text-${lastIndex}`} style={{ color: '#fff', fontSize: 15, lineHeight: 21 }}>
              {text.substring(lastIndex, match.index)}
            </Text>
          );
        }

        // Add mention
        const username = match[1];
        const mentionedUserId = match[2];
        parts.push(
          <TouchableOpacity
            key={`mention-${mentionedUserId}`}
            onPress={() => router.push(`/(modals)/user-profile?userId=${mentionedUserId}` as any)}
          >
            <Text style={{ color: '#6366f1', fontSize: 15, lineHeight: 21, fontWeight: '600' }}>
              @{username}
            </Text>
          </TouchableOpacity>
        );

        lastIndex = mentionRegex.lastIndex;
      }

      // Add remaining text
      if (lastIndex < text.length) {
        parts.push(
          <Text key={`text-end`} style={{ color: '#fff', fontSize: 15, lineHeight: 21 }}>
            {text.substring(lastIndex)}
          </Text>
        );
      }

      return parts.length > 0 ? parts : <Text style={{ color: '#fff', fontSize: 15, lineHeight: 21 }}>{text}</Text>;
    };

    // Wrap every message (own and received) in TouchableOpacity for long-press
    return (
      <TouchableOpacity
        onLongPress={() => handleLongPress(item)}
        delayLongPress={500}
        activeOpacity={0.8}
      >
        <View style={[cs.bubble, isOwn ? cs.bubbleRight : cs.bubbleLeft]}>
          {/* Only show avatar and username in server chats, not DMs */}
          {!isDM && (
            <View style={cs.bubbleAvatarWrap}>
              {item.author?.avatar ? (
                <Image source={{ uri: item.author.avatar }} style={cs.bubbleAvatar} />
              ) : (
                <View style={[cs.bubbleAvatar, { backgroundColor: 'rgba(99,102,241,0.25)' }]}>
                  <Ionicons name="person" size={12} color="rgba(255,255,255,0.5)" />
                </View>
              )}
              <TouchableOpacity
                onPress={() => {
                  const userId = item.author?.id || item.author?._id || item.author_id;
                  if (userId) {
                    router.push(`/(modals)/user-profile?userId=${userId}` as any);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>
                  {item.author?.username || 'User'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={[cs.bubbleBody, isOwn ? cs.bubbleBodyOwn : cs.bubbleBodyOther]}>
            {/* Show replied to message if this is a reply */}
            {item.replied_to_message && (
              <View style={cs.replyPreview}>
                <Text style={cs.replyAuthor}>
                  @{item.replied_to_message.author?.username || 'User'}
                </Text>
                <Text style={cs.replyContent} numberOfLines={1}>
                  {item.replied_to_message.content}
                </Text>
              </View>
            )}
            {attachImg && (
              <Image
                source={{ uri: attachImg.url }}
                style={{ width: 200, height: 200, borderRadius: 12, marginBottom: item.content ? 6 : 0 }}
                resizeMode="cover"
              />
            )}
            {item.content ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {parseMentions(item.content)}
              </View>
            ) : null}
            {item.is_edited && (
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>edited</Text>
            )}
            <Text style={cs.bubbleTime}>
              {new Date(item.created_at || item.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>

            {/* Reactions */}
            {item.reactions && item.reactions.length > 0 && (
              <View style={[cs.reactionContainer, isOwn ? { right: 0 } : { left: 0 }]}>
                {item.reactions.map((emoji, idx) => (
                  <View key={idx} style={cs.reactionBadge}>
                    <Text style={{ fontSize: 12 }}>{emoji}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const currentTypingUsers = typingUsers.filter(
    (u) => u.channelId === channelId && u.userId !== userId
  );

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(15,15,30,0.97)' }}>
      {/* Header */}
      <View style={[cs.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => safeGoBack('/servers')} style={cs.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          {/* Show username at top only in DMs */}
          {isDM ? (
            <TouchableOpacity
              onPress={() => {
                // Find the other user in DM
                const otherUser = channelMessages.find(
                  (msg) => (msg.author?.id || msg.author?._id || msg.author_id) !== userId
                )?.author;
                if (otherUser) {
                  router.push(`/(modals)/user-profile?userId=${otherUser.id || otherUser._id}` as any);
                }
              }}
              style={{ marginTop: 4 }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {channelMessages.find((msg) => (msg.author?.id || msg.author?._id || msg.author_id) !== userId)?.author?.avatar && (
                  <Image
                    source={{ uri: channelMessages.find((msg) => (msg.author?.id || msg.author?._id || msg.author_id) !== userId)?.author?.avatar }}
                    style={{ width: 32, height: 32, borderRadius: 16, marginRight: 8 }}
                  />
                )}
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                  {channelMessages.find((msg) => (msg.author?.id || msg.author?._id || msg.author_id) !== userId)?.author?.username || 'User'}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                #{channelName || 'general'}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                {serverName || 'Server'}
              </Text>
            </>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={channelMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20 }}
          inverted
        />

        {currentTypingUsers.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
              {currentTypingUsers.map(u => u.username).join(', ')} {currentTypingUsers.length === 1 ? 'is' : 'are'} typing...
            </Text>
          </View>
        )}

        {replyingToMessage && (
          <View style={cs.replyPreviewContainer}>
            <View style={cs.replyPreviewContent}>
              <Text style={cs.replyPreviewText}>Replying to @{replyingToMessage.author?.username}</Text>
              <Text style={cs.replyPreviewMessage} numberOfLines={1}>{replyingToMessage.content}</Text>
            </View>
            <TouchableOpacity onPress={cancelReply} style={cs.cancelReplyButton}>
              <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
        )}

        <View style={[cs.inputBar, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity onPress={pickAndSendImage} style={[cs.sendBtn, { backgroundColor: 'rgba(255,255,255,0.08)', marginRight: 10 }]}>
            <Ionicons name="image-outline" size={22} color="#fff" />
          </TouchableOpacity>
          <TextInput
            style={cs.input}
            value={messageText}
            onChangeText={handleTyping}
            placeholder="Type a message..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!messageText.trim() && !uploading}
            style={[cs.sendBtn, { backgroundColor: '#6366f1' }, (!messageText.trim() && !uploading) && { opacity: 0.5 }]}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Editing Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEditingModalVisible}
        onRequestClose={cancelEdit}
      >
        <View style={cs.modalOverlay}>
          <View style={cs.modalContent}>
            <View style={cs.modalHeader}>
              <Text style={cs.modalTitle}>Edit Message</Text>
              <TouchableOpacity onPress={cancelEdit} style={cs.closeButton}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Edit your message..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={cs.editInput}
              multiline
              maxLength={2000}
              autoFocus
            />

            <View style={cs.modalActions}>
              <TouchableOpacity
                onPress={cancelEdit}
                style={[cs.modalButton, cs.cancelButton]}
              >
                <Text style={cs.buttonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSend}
                disabled={!messageText.trim()}
                style={[cs.modalButton, cs.saveButton, !messageText.trim() && cs.disabledButton]}
              >
                <Text style={cs.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Context Menu Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={contextMenuVisible}
        onRequestClose={closeContextMenu}
      >
        <TouchableWithoutFeedback onPress={closeContextMenu}>
          <View style={cs.contextMenuOverlay}>
            <View style={cs.contextMenu}>
              <TouchableOpacity
                style={cs.contextMenuItem}
                onPress={() => {
                  setShowEmojiPicker(true);
                }}
              >
                <Ionicons name="happy-outline" size={20} color="#6366f1" />
                <Text style={cs.contextMenuItemText}>React</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={cs.contextMenuItem}
                onPress={() => {
                  if (selectedMessage) handleReply(selectedMessage);
                  closeContextMenu();
                }}
              >
                <Ionicons name="return-up-forward-outline" size={20} color="#6366f1" />
                <Text style={cs.contextMenuItemText}>Reply</Text>
              </TouchableOpacity>

              {selectedMessage && ((selectedMessage.author?.id || selectedMessage.author?._id || selectedMessage.author_id) === userId) && (
                <TouchableOpacity
                  style={cs.contextMenuItem}
                  onPress={() => {
                    handleEdit(selectedMessage);
                    closeContextMenu();
                  }}
                >
                  <Ionicons name="create-outline" size={20} color="#6366f1" />
                  <Text style={cs.contextMenuItemText}>Edit</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[cs.contextMenuItem, cs.contextMenuItemDanger]}
                onPress={() => {
                  if (selectedMessage) handleDelete(selectedMessage);
                  closeContextMenu();
                }}
              >
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                <Text style={[cs.contextMenuItemText, cs.contextMenuItemTextDanger]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <EmojiPicker
        visible={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onSelect={handleSelectEmoji}
      />
    </View>
  );
}

const cs = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
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
  bubble: { flexDirection: 'row', marginBottom: 10 },
  bubbleRight: { justifyContent: 'flex-end' },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleAvatarWrap: { marginRight: 8, justifyContent: 'flex-end', alignItems: 'center' },
  bubbleAvatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bubbleBody: { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleBodyOwn: { backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
  bubbleBodyOther: { backgroundColor: 'rgba(255,255,255,0.08)', borderBottomLeftRadius: 4 },
  bubbleTime: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(15,15,30,0.95)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    fontSize: 15,
    maxHeight: 120,
    marginRight: 10,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  replyPreview: {
    backgroundColor: 'rgba(99,102,241,0.1)',
    borderLeftWidth: 2,
    borderLeftColor: '#6366f1',
    paddingLeft: 8,
    paddingBottom: 4,
    marginBottom: 4,
  },
  replyAuthor: {
    color: 'rgba(99,102,241,0.8)',
    fontSize: 11,
    fontWeight: '600',
  },
  replyContent: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  replyPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99,102,241,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewText: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '600',
  },
  replyPreviewMessage: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  cancelReplyButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'rgba(30,30,46,0.95)',
    width: '90%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  editInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 15,
    minHeight: 100,
    maxHeight: 200,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  saveButton: {
    backgroundColor: '#6366f1',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Context menu styles
  contextMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contextMenu: {
    backgroundColor: 'rgba(30,30,46,0.95)',
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  contextMenuItemDanger: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    marginTop: 4,
  },
  contextMenuItemText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  contextMenuItemTextDanger: {
    color: '#ef4444',
  },
  // Reaction styles
  reactionContainer: {
    position: 'absolute',
    bottom: -12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10
  },
  reactionBadge: {
    backgroundColor: '#262626',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  emojiPickerContainer: {
    flexDirection: 'row',
    backgroundColor: '#262626',
    padding: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'center',
    marginBottom: 100
  },
  emojiItem: { paddingHorizontal: 8 },
});